const { Clutter } = imports.gi;
const Main = imports.ui.main;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { ShellVersionMatch } = Me.imports.src.utils.compatibility;
const Tweener = imports.ui.tweener;
const {
    BaseTilingLayout,
} = Me.imports.src.layout.msWorkspace.tilingLayouts.baseTiling;
const { TranslationAnimator } = Me.imports.src.widget.translationAnimator;
const { MsWindow } = Me.imports.src.layout.msWorkspace.msWindow;

/* exported MaximizeLayout */
var MaximizeLayout = class MaximizeLayout extends BaseTilingLayout {
    constructor(msWorkspace) {
        super(msWorkspace);
        this.translationAnimator = new TranslationAnimator();
        this.translationAnimator.connect('transition-completed', () => {
            this.endTransition();
        });
        this.currentWindowIndex = msWorkspace.focusedIndex;
    }

    onFocusChanged(windowFocused, oldWindowFocused) {
        log('onFocusChanged');
        //if (!this.msWorkspace.msWindowList.includes(oldWindowFocused)) return;
        if (!windowFocused.isDialog) {
            const oldIndex = this.currentWindowIndex;
            this.currentWindowIndex = this.msWorkspace.focusedIndex;
            if (this.currentWindowIndex === oldIndex) return;

            if (Me.loaded) {
                this.startTransition(this.currentWindowIndex, oldIndex);
            }
        }
    }

    alterTileable(tileable) {
        tileable.show();
        if (tileable instanceof MsWindow) {
            tileable.maximizeDraggedConnectId = tileable.connect(
                'dragged_changed',
                () => {
                    if (tileable.dragged) {
                        tileable.translation_x = 0;
                    }
                }
            );
        }
    }

    restoreTileable(tileable) {
        tileable.translation_x = 0;
        if (tileable.maximizeDraggedConnectId) {
            tileable.disconnect(tileable.maximizeDraggedConnectId);
            delete tileable.maximizeDraggedConnectId;
        }
    }

    onTileableListChanged(tileableList, oldTileableList) {
        // If the order of the windows changed try to follow the current visible window
        /* if (oldTileableList.length === tileableList.length) {
            let currentVisibleWindow = oldTileableList[this.currentWindowIndex];
            let indexOfCurrentVisibleWindowInNewWindows = tileableList.indexOf(
                currentVisibleWindow
            );
            if (indexOfCurrentVisibleWindowInNewWindows !== -1) {
                this.currentWindowIndex = indexOfCurrentVisibleWindowInNewWindows;
            }
        } */

        super.onTileableListChanged(tileableList, oldTileableList);

        // if a window has been removed animate the transition (either to the "next" if there is one or the "previous" if the window removed was the last)
        if (oldTileableList.length - tileableList.length === 1) {
            let windowRemovedIndex = oldTileableList.findIndex(
                (tileable) => !tileableList.includes(tileable)
            );
            const oldIndex =
                windowRemovedIndex === oldTileableList.length - 1
                    ? windowRemovedIndex
                    : -1;
        }
    }

    onTileRegulars(tileableList) {
        if (this.animationInProgress) {
            return;
        }
        const workArea = Main.layoutManager.getWorkAreaForMonitor(
            this.monitor.index
        );
        tileableList.forEach((actor, index) => {
            // Unclip windows in maximize
            if (actor.has_clip) {
                actor.set_z_position(0);
                actor.remove_clip();
            }
            if (!actor.dragged) {
                actor.set_position(0, 0);
                actor.set_size(workArea.width, workArea.height);
                actor.translation_x = index * workArea.width;
            }
            if (index !== this.msWorkspace.focusedIndex && !actor.dragged) {
                actor.hide();
            } else {
                actor.show();
            }
            this.msWorkspace.msWorkspaceActor.tileableContainer.translation_x =
                -this.msWorkspace.focusedIndex * workArea.width;
        });
    }

    onDestroy() {
        super.onDestroy();
        this.msWorkspace.msWorkspaceActor.tileableContainer.translation_x = 0;
        this.msWorkspace.msWindowList.forEach((msWindow) => {
            if (msWindow !== this.windowNotDialogFocused) {
                msWindow.show();
            }
        });
    }

    startTransition(newIndex, oldIndex) {
        const workArea = Main.layoutManager.getWorkAreaForMonitor(
            this.monitor.index
        );
        let i = oldIndex;
        while (i != newIndex) {
            this.msWorkspace.tileableList[i].show();
            if (newIndex > oldIndex) {
                i++;
            } else {
                i--;
            }
        }
        this.msWorkspace.tileableList[newIndex].show();
        if (ShellVersionMatch('3.32')) {
            Tweener.addTween(
                this.msWorkspace.msWorkspaceActor.tileableContainer,
                {
                    translation_x: -newIndex * workArea.width,
                    time: Math.min(0.25 * Math.abs(oldIndex - newIndex), 0.4),
                    transition: 'easeOutQuad',
                    onComplete: () => {
                        this.endTransition();
                    },
                }
            );
        } else {
            this.msWorkspace.msWorkspaceActor.tileableContainer.ease({
                translation_x: -newIndex * workArea.width,
                duration: Math.min(250 * Math.abs(oldIndex - newIndex), 400),
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    this.endTransition();
                },
            });
        }
    }

    endTransition() {
        this.onTile();
    }
};

MaximizeLayout.key = 'maximize';
