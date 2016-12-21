
AchSoPlayer.prototype.startModel = function(data, user) {
    this.batches = [];
    this.data = data;
    this.user = user;
    this.time = 0.0;
    this.active = false;
    this.annotationSelectRadius = 50.0;
    this.annotationDragDeadZone = 10.0;
    this.snapDistance = 0.05;
    this.importManifest(data);

    this.undoStream = [];
    this.redoStream = [];
    this.maxUndoDepth = 100;
};

AchSoPlayer.prototype.resetModel = function(data) {
    this.batches = [];
    this.data = data;
    this.importManifest(data);

    this.undoStream = [];
    this.redoStream = [];
};

AchSoPlayer.prototype.importManifest = function(manifest) {
    this.manifest = manifest;
    if (manifest.annotations) {
        for (var i = 0; i < manifest.annotations.length; i++) {
            this.addAnnotation(this.importAnnotation(manifest.annotations[i]));
        }
    }
};

AchSoPlayer.prototype.importAnnotation = function(annotation) {
    return {
        original: annotation,
        author: annotation.author,
        pos: annotation.position,
        text: annotation.text,
        time: annotation.time / 1000.0,
        createdTimestamp: annotation.createdTimestamp,
    };
};

AchSoPlayer.prototype.exportManifest = function(manifest) {
    var manifest = _.cloneDeep(this.manifest);
    var newAnnotations = [];
    for (var i = 0; i < this.batches.length; i++) {
        var batch = this.batches[i];
        for (var j = 0; j < batch.annotations.length; j++) {
            var annotation = batch.annotations[j];

            newAnnotations.push(this.exportAnnotation(annotation));
        }
    }
    manifest.annotations = newAnnotations;

    normalizeManifest(manifest);

    return manifest;
};

AchSoPlayer.prototype.exportAnnotation = function(annotation) {
    var time = Math.round(annotation.time * 1000.0);
    var x = annotation.pos.x;
    var y = annotation.pos.y;

    var original = annotation.original;
    if (original) {
        time = epsilonFix(original.time, time, 0.5);
        x = epsilonFix(original.x, x, 0.0005);
        y = epsilonFix(original.y, y, 0.0005);
    }

    var result = {
        author: annotation.author,
        position: { x: x, y: y },
        text: annotation.text,
        time: time,
    };

    if (annotation.createdTimestamp)
        result.createdTimestamp = annotation.createdTimestamp;

    return result;
};

AchSoPlayer.prototype.allowEdit = function() {
    return !!this.user;
};

AchSoPlayer.prototype.createUndoPoint = function() {
    return {
        time: this.time,
        batches: _.cloneDeep(this.batches),
        batchIndex: this.batches.indexOf(this.batch),
    };
};

AchSoPlayer.prototype.commitUndoPoint = function(undoPoint) {

    this.redoStream = [];
    this.undoStream.push(undoPoint);
    if (this.undoStream.length > this.maxUndoDepth) {
        this.undoStream.shift();
    }
};

AchSoPlayer.prototype.saveUndoPoint = function() {
    this.commitUndoPoint(this.createUndoPoint());
};

AchSoPlayer.prototype.restoreState = function(toStream, fromStream) {
    var undo = toStream.pop();
    if (!undo)
        return false;

    fromStream.push({
        time: this.time,
        batches: this.batches,
        batchIndex: this.batches.indexOf(this.batch),
    });

    this.time = undo.time;
    this.batches = undo.batches;
    if (undo.batchIndex >= 0) {
        this.batch = this.batches[undo.batchIndex];
    } else {
        this.batch = null;
    }

    return true;
};

AchSoPlayer.prototype.commitUndo = function() {
    return this.restoreState(this.undoStream, this.redoStream);
};

AchSoPlayer.prototype.commitRedo = function() {
    return this.restoreState(this.redoStream, this.undoStream);
};

AchSoPlayer.prototype.canUndo = function() {
    return this.undoStream.length > 0;
};

AchSoPlayer.prototype.canRedo = function() {
    return this.redoStream.length > 0;
};

AchSoPlayer.prototype.batchNear = function(time, dist) {
    var closest = null;
    for (var i = 0; i < this.batches.length; i++) {
        var diff = Math.abs(this.batches[i].time - time);
        if (diff < dist) {
            dist = diff;
            closest = this.batches[i];
        }
    }
    return closest;
};

AchSoPlayer.prototype.batchAt = function(time) {
    return this.batchNear(time, 0.01);
};

AchSoPlayer.prototype.batchBetween = function(start, end) {
    for (var i = 0; i < this.batches.length; i++) {
        var time = this.batches[i].time;
        if (start < time && time <= end) {
            return this.batches[i];
        } else if (end < time) {
            break;
        }
    }
    return null;
};

AchSoPlayer.prototype.createBatch = function(time) {
    var i;
    for (i = 0; i < this.batches.length; i++) {
        if (this.batches[i].time > time)
            break;
    }
    var batch = {
        time: time,
        annotations: [],
    };
    this.batches.splice(i, 0, batch);

    if (this.loaded) {
        this.updateSeekBarView();
    }
    return batch;
};

AchSoPlayer.prototype.setBatch = function(batch) {
    this.batch = batch;
    if (this.loaded) {
        this.updateAnnotationView();
    }
};

AchSoPlayer.prototype.findOrCreateAnnotation = function(pos) {
    var batch = this.batch;
    var annotations = batch.annotations;

    var closest = null;
    var closestDist = Math.pow(this.annotationSelectRadius, 2);
    for (var i = 0; i < annotations.length; i++) {
        var annotation = annotations[i];

        var dx = (annotation.pos.x - pos.x) * this.videoWidth;
        var dy = (annotation.pos.y - pos.y) * this.videoHeight;
        var dist = dx * dx + dy * dy;

        if (dist < closestDist) {
            closestDist = dist;
            closest = annotation;
        }
    }

    if (closest) {
        return { annotation: closest, isNew: false };
    }

    var newAnnotation = {
        original: null,
        author: this.user,
        pos: { x: pos.x, y: pos.y },
        time: batch.time,
        text: '',
        createdTimestamp: (new Date()).toISOString(),
    };
    batch.annotations.push(newAnnotation);
    return { annotation: newAnnotation, isNew: true };
};

AchSoPlayer.prototype.findOrCreateBatch = function(time) {
    var batch = this.batchAt(time);
    if (!batch) {
        batch = this.createBatch(time);
    }
    return batch;
};

AchSoPlayer.prototype.addAnnotation = function(annotation) {
    var batch = this.findOrCreateBatch(annotation.time);
    batch.annotations.push(annotation);
};

AchSoPlayer.prototype.deleteAnnotation = function(annotation) {
    var batch = this.batchAt(annotation.time);
    if (!batch) return;
    var index = batch.annotations.indexOf(annotation);
    if (index < 0) return;
    batch.annotations.splice(index, 1);

    if (batch.annotations.length > 0)
        return;
    
    var batchIndex = this.batches.indexOf(batch);
    if (batchIndex < 0) return;
    this.batches.splice(batchIndex, 1);

    if (this.batch == batch)
        this.batch = null;
};

AchSoPlayer.prototype.calculateAnnotationWaitTime = function(annotations)
{
    // Time constants in seconds.
    var timeAlways = 2.0;
    var timePerAnnotation = 0.5;
    var timePerSubtitle = 1.0;
    var timePerLetter = 0.03;
    var timeMaximum = 10.0;

    var waitTime = timeAlways;

    for (var i = 0; i < annotations.length; i++) {
        waitTime += timePerAnnotation;
        var text = annotations[i].text.replace(/\s+/g, '');
        if (text.length > 0) {
            waitTime += timePerSubtitle;
            waitTime += text.length * timePerLetter;
        }
    }

    waitTime = Math.min(waitTime, timeMaximum);
    
    return waitTime;
}

AchSoPlayer.prototype.calculateWaitTime = function(batch)
{
    if (!batch || batch.annotations.length == 0)
        return 1;

    return this.calculateAnnotationWaitTime(batch.annotations);
}
