
AchSoPlayer.prototype.fetchElements = function(root) {
    this.elements = {
        root: root,
        video: root.querySelector(".acp-video"),
        videoWrapper: root.querySelector(".acp-video-wrapper"),
        videoBackground: root.querySelector(".acp-video-background"),
        playButton: root.querySelector(".acp-play-button"),
        undoButton: root.querySelector(".acp-undo-button"),
        redoButton: root.querySelector(".acp-redo-button"),
        fullscreenButton: root.querySelector(".acp-fullscreen-button"),
        seekBar: root.querySelector(".acp-seek-bar"),
        seekBarFiller: root.querySelector(".acp-seek-bar-filler"),
        seekCatcher: root.querySelector(".acp-seek-catcher"),
        waitBar: root.querySelector(".acp-wait-bar"),
        waitFade: root.querySelector(".acp-wait-fade"),
        annotationEdit: root.querySelector(".acp-annotation-edit"),
        annotationTextInput: root.querySelector(".acp-annotation-text-input"),
        annotationSaveButton: root.querySelector(".acp-annotation-save-button"),
        annotationDeleteButton: root.querySelector(".acp-annotation-delete-button"),
        subtitles: root.querySelector(".acp-subtitles"),
        overlay: root.querySelector(".acp-overlay"),
        playbackTime: root.querySelector(".current-time"),
        loadedPercentage: root.querySelector('.acp-loaded')
    };
};

AchSoPlayer.prototype.startView = function(rootElement, data) {
    this.fetchElements(rootElement);

    var player = this;

    this.doingWaitAnimation = false;

    // Video player
    this.elements.video.addEventListener("loadedmetadata", function() {
        var width = player.elements.video.videoWidth;
        var height = player.elements.video.videoHeight;
        player.setVideoSize(width, height);
        player.activate();
    });

    this.elements.video.addEventListener("durationchange", function() {
        player.videoDuration = player.elements.video.duration;
        player.updateSeekBarView();
    });

    this.elements.video.addEventListener("timeupdate", function() {
        player.timeUpdate(player.elements.video.currentTime);
    });

    this.elements.video.addEventListener("progress", function(e) {
        if (this.buffered.length > 0) {
            var r = this.buffered;
            var total = this.duration;

            var end = r.end(0);
            var newValue = Math.ceil((end / total)*100);

            player.elements.loadedPercentage.innerHTML = newValue + " %";

            if (newValue >= 100) {
                player.elements.loadedPercentage.classList.add('fade-out');
            }
        }
    });

    this.elements.video.addEventListener("ended", function() {
        player.stopOnEnd();
    });

    this.elements.video.addEventListener("error", function(e) {
      window.parent.postMessage(JSON.stringify({
        data: {id: data.id},
        type: 'video:error'
      }), "*");
    });

    // @BrowserHack(Firefox): Seeking when paused results in black frames
    // sometimes with Firefox so force repaint the video on seek.
    if (/firefox/i.test(navigator.userAgent)) {
        this.elements.video.addEventListener("seeked", function() {
            player.elements.video.style.display = "inline";
            player.elements.video.offsetHeight;
            player.elements.video.style.display = "block";
        });
    }

    // Video controls
    this.elements.playButton.addEventListener("click", function() {
        if (player.active) {
            player.userPlay();
            player.hideOverlay();
        }
    });

    relativeClickHandler(this.elements.seekCatcher, function(state, pos) {
        player.userSeek(pos.x * player.videoDuration, state);
    });

    this.elements.undoButton.addEventListener("click", function() {
        player.doUndo();
    });

    this.elements.redoButton.addEventListener("click", function() {
        player.doRedo();
    });

    this.elements.fullscreenButton.addEventListener("click", function() {
        player.fullscreenToggle();
    });

    if (this.options.lazyLoadVideo === true) {
        var lazyLoad = function (event) {
            event.preventDefault();
            this.elements.video.removeAttribute('preload');
            this.elements.root.removeEventListener('click', lazyLoad, false);
            return false;
        }.bind(this);

        this.elements.root.addEventListener('click', lazyLoad, false);
    }

    this.elements.fullscreenButton.classList.remove("acp-disabled");

    // Annotation dragging controls
    relativeClickHandler(this.elements.video, function(state, pos) {
        var e = { state: state, pos: pos };
        player.editAnnotation(e);
    });

    // Annotation edit controls
    this.elements.annotationTextInput.addEventListener("input", function() {
        player.annotationTextInput(player.elements.annotationTextInput.value);
    });

    this.elements.annotationSaveButton.addEventListener("click", function() {
        player.annotationSaveButton();
    });

    this.elements.annotationDeleteButton.addEventListener("click", function() {
        player.annotationDeleteButton();
    });

    // Keyboard shortcuts
    window.addEventListener("keydown", function(e) {
        if (e.target.tagName.match(/input|textarea/i))
            return;

        if (e.keyCode == 46) { // Delete
            player.annotationDeleteButton();
            e.preventDefault();
        } else if (e.keyCode == 32) { // Space
            player.userPlay();
            e.preventDefault();
        } else if (e.ctrlKey && !e.shiftKey && e.keyCode == 90) { // Ctrl+Z
            player.doUndo();
            e.preventDefault();
        } else if (e.ctrlKey && !e.shiftKey && e.keyCode == 89) { // Ctrl+Y
            player.doRedo();
            e.preventDefault();
        } else if (e.ctrlKey && e.shiftKey && e.keyCode == 90) { // Ctrl+Shift+Z
            player.doRedo();
            e.preventDefault();
        } else if (e.keyCode == 27) { // Escape
            removeFullscreenElement();
        }
    });

    // Resize the video container every now and then (there isn't really any
    // portable resize event)
    this.videoWrapperResizeinterval = window.setInterval(function() {
        player.poll();
    }, 500);

    // Annotation view
    this.annotationView = new DomView({
        container: this.elements.videoWrapper,
        newElement: function() {
            var marker = elemWithClasses('div', 'acp-annotation');
            return marker
        },
        toElement: function(element, annotation) {
            if (annotation == player.selectedAnnotation) {
                element.classList.add("acp-selected-annotation");
            } else {
                element.classList.remove("acp-selected-annotation");
            }

            var name = 'Unknown';

            if (annotation.author.name) {
                name = annotation.author.name;
            } else if (annotation.author.username) {
                name = annotation.author.username;
            }

            var hash = fnv1aHashString(name);
            var color = getAnnotationColorForHash(hash);
            var gradientString = "radial-gradient(rgba(255,255,255, 0.0) 37%, rgba(255,255,255, 0.9) 40%, rgba(255,255,255, 0.9) 45%, rgba(68,153,136, 0.8) 47%, rgba(68,153,136, 0.4) 53%, rgba(68,153,136, 0.0) 55%, rgba(68,153,136, 0.0) 56%, " + color  + " 60%, " + color + " 62%, rgba(85,204,153, 0.0) 66%)"

            element.style.left = cssPercent(annotation.pos.x);
            element.style.top = cssPercent(annotation.pos.y);
            element.style.background = gradientString;
        },
    });

    // Seek bar view
    this.seekBarView = new DomView({
        container: this.elements.seekBar,
        newElement: function(batch) {
            var el = elemWithClasses('div', 'acp-seek-annotation');

            var color = getBatchColor(batch);

            if (color) {
                var bg = "radial-gradient(rgba(255,0,0, 0.0) 47%, " + color + " 60%, " + color + " 62%, rgba(255,0,0, 0.0) 73%)";
                el.style.background = bg;
            }

            return el;
        },
        toElement: function(element, batch) {
            var color = getBatchColor(batch);

            if (color) {
                var bg = "radial-gradient(rgba(255,0,0, 0.0) 47%, " + color + " 60%, " + color + " 62%, rgba(255,0,0, 0.0) 73%)";
                element.style.background = bg;
            }

            if (this.state == AnnotationPause) {
                element.classList.add("acp-waiting");
            } else {
                element.classList.remove("acp-waiting");
            }

            element.style.left = cssPercent(batch.time / this.videoDuration);
        }.bind(this),
    });

    registerFullscreenCallback(function() {
        player.poll();
    });

    this.elements.video.src = data.videoUri;

    this.poll();

    if (this.options.lazyLoadVideo === true) {
    }
};

AchSoPlayer.prototype.resetView = function() {
};

AchSoPlayer.prototype.stopView = function() {
    window.clearInterval(this.videoWrapperResizeInterval);
};

AchSoPlayer.prototype.setBarPosition = function(time) {
    this.lastBarPosition = time;
    this.elements.playbackTime.innerHTML = dateToMMSS(time);
    this.elements.seekBarFiller.style.width = cssPercent(time / this.videoDuration);
};

AchSoPlayer.prototype.hideOverlay = function() {
    if (player.elements.overlay) {
        if (!player.elements.overlay.classList.contains("acp-overlay-hidden")) {
            player.elements.overlay.classList.add("acp-overlay-hidden");

            // Remove the overlay completely from the layout in case browsers don't
            // optimize the zero opacity case.
            window.setTimeout(function() {
                player.elements.overlay.classList.add("acp-force-hidden-no-layout");
            }, 300);
        }
    }
};

AchSoPlayer.prototype.setVideoSize = function(width, height) {
    this.videoWidth = width;
    this.videoHeight = height;
    this.videoAspect = width / height;

    this.updateVideoWrapperSize();
};

AchSoPlayer.prototype.fullscreenToggle = function() {
    if (!isFullscreenElement(player.elements.root)) {
        requestFullscreenElement(player.elements.root);
    } else {
        removeFullscreenElement();
    }
}

AchSoPlayer.prototype.poll = function() {
    if (isFullscreenElement(this.elements.root)) {
        this.elements.root.classList.add("acp-fullscreen");
        this.elements.root.classList.remove("acp-inline");
        this.elements.fullscreenButton.innerHTML = "&#xE5D1;";
    } else {
        this.elements.root.classList.remove("acp-fullscreen");
        this.elements.root.classList.add("acp-inline");
        this.elements.fullscreenButton.innerHTML = "&#xE5D0;";
    }

    if (this.allowEdit()) {
        this.elements.undoButton.classList.remove("acp-force-hidden-no-layout");
        this.elements.redoButton.classList.remove("acp-force-hidden-no-layout");
    } else {
        this.elements.undoButton.classList.add("acp-force-hidden-no-layout");
        this.elements.redoButton.classList.add("acp-force-hidden-no-layout");
    }

    // Update after CSS class set has taken effect
    var player = this;
    window.setTimeout(function() {
        player.updateVideoWrapperSize();
    }, 50);
};

AchSoPlayer.prototype.updateVideoWrapperSize = function(width, height) {
    if (!this.videoAspect)
        return;

    var bgWidth = this.elements.videoBackground.clientWidth;
    var bgHeight = this.elements.videoBackground.clientHeight;
    var bgAspect = bgWidth / bgHeight;

    // Scale the video so that it always fills one dimension of the container
    if (this.videoAspect >= bgAspect) {
        // Video is more horizontal than the container, use container width.
        this.playerWidth = bgWidth;
        this.playerHeight = this.playerWidth / this.videoAspect;
    } else {
        // Video is more vertical than the container, use container height.
        this.playerHeight = bgHeight;
        this.playerWidth = this.playerHeight * this.videoAspect;
    }

    this.elements.videoWrapper.style.width = this.playerWidth + "px";
    this.elements.videoWrapper.style.height = this.playerHeight + "px";

    var fontSize = bgWidth / 30;
    fontSize = clamp(fontSize, 20, 35);
    fontSize = Math.round(fontSize);
    this.elements.subtitles.style.fontSize = fontSize + "px";

    var shadowRadius = Math.round(fontSize / 6);
    this.elements.subtitles.style.textShadow = "0px 0px " + shadowRadius + "px #000";

    var snapDistance = 20; // px
    this.snapDistance = this.videoDuration * (snapDistance / bgWidth);
};

AchSoPlayer.prototype.pauseVideo = function() {
    this.elements.video.pause();
};

AchSoPlayer.prototype.playVideo = function() {
    this.elements.video.play();
};

AchSoPlayer.prototype.seekVideo = function(time) {
    if (isNaN(time)) return;

    this.elements.video.currentTime = time;
};

AchSoPlayer.prototype.setPlayButton = function(isPlay, forceActive) {
    var button = this.elements.playButton;

    if (this.active || forceActive) {
        button.classList.remove("acp-disabled");
    } else {
        button.classList.add("acp-disabled");
    }

    if (isPlay) {
        button.innerHTML = "&#xE037;";
    } else {
        button.innerHTML = "&#xE034;";
    }
};

AchSoPlayer.prototype.showAnnotationEdit = function(annotation) {
    this.elements.subtitles.classList.add("acp-hidden");
    this.elements.annotationEdit.classList.add("acp-visible");
    this.elements.annotationTextInput.value = annotation.text;
};

AchSoPlayer.prototype.hideAnnotationEdit = function() {
    this.elements.subtitles.classList.remove("acp-hidden");
    this.elements.annotationEdit.classList.remove("acp-visible");
    this.elements.annotationEdit.classList.remove("acp-transparent");
    this.elements.annotationTextInput.blur();
};

AchSoPlayer.prototype.annotationDragStart = function() {
    this.elements.annotationEdit.classList.add("acp-transparent");
};

AchSoPlayer.prototype.annotationDragStop = function() {
    this.elements.annotationEdit.classList.remove("acp-transparent");
};

AchSoPlayer.prototype.annotationPressStart = function() {
    this.elements.annotationEdit.classList.add("acp-noclick");
    this.elements.seekCatcher.classList.add("acp-disable");
};

AchSoPlayer.prototype.annotationPressStop = function() {
    this.elements.annotationEdit.classList.remove("acp-noclick");
    this.elements.seekCatcher.classList.remove("acp-disable");
};

AchSoPlayer.prototype.updateAnnotationView = function() {
    var annotations;
    if (this.active && this.batch) {
        annotations = this.batch.annotations;
    } else {
        annotations = [];
    }

    this.annotationView.update(annotations);

    var subtitleList = [];
    for (var i = 0; i < annotations.length; i++) {
        var annotationText = annotations[i].text.trim();
        if (annotationText != "") {
            subtitleList.push("<span>" + stringToHTMLSafe(annotationText) + "</span>");
        }
    }

    var subtitleText = subtitleList.join("");
    this.elements.subtitles.innerHTML = subtitleText;
};

AchSoPlayer.prototype.updateSeekBarView = function() {
    var batches;
    if (this.active) {
        batches = this.batches;
    } else {
        batches = [];
    }
    this.seekBarView.update(batches);
    if (this.state == AnnotationPause) {
        this.elements.seekBarFiller.classList.add("acp-waiting");
    } else {
        this.elements.seekBarFiller.classList.remove("acp-waiting");
    }
};

AchSoPlayer.prototype.doWaitAnimation = function(time) {
    this.doingWaitAnimation = true;
    this.waitAnimationStart = getTimeSeconds();
    this.waitAnimationDuration = time;

    this.elements.waitFade.style.transition = "";
    this.elements.waitFade.style.width = '0%';
    this.elements.waitFade.style.opacity = '1.0';

    this.elements.waitBar.style.transition = "width " + time + "s linear";
    this.elements.waitBar.style.width = "100%";
};

AchSoPlayer.prototype.stopWaitAnimation = function() {
    if (!this.doingWaitAnimation)
        return;
    this.doingWaitAnimation = false;

    var time = getTimeSeconds();
    var delta = time - this.waitAnimationStart;
    var length = Math.min(delta / this.waitAnimationDuration, 1.0);

    this.elements.waitBar.style.transition = "";
    this.elements.waitBar.style.width = "0%";

    this.elements.waitFade.style.transition = "opacity 0.2s ease-out";
    this.elements.waitFade.style.width = cssPercent(length);
    this.elements.waitFade.style.opacity = '0.0';
};

AchSoPlayer.prototype.updateUndoButtonsView = function(undo, redo) {
    if (this.active && this.canUndo()) {
        this.elements.undoButton.classList.remove("acp-disabled");
    } else {
        this.elements.undoButton.classList.add("acp-disabled");
    }
    if (this.active && this.canRedo()) {
        this.elements.redoButton.classList.remove("acp-disabled");
    } else {
        this.elements.redoButton.classList.add("acp-disabled");
    }
};
