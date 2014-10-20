/**
 * angular-talk
 * Chat and comments engine
 *
 * @author Javier Marín <contacto@ideatic.net>
 */
'use strict';

angular.module('angular-talk', [])
    .controller('AngularTalkController', ['$scope', '$http', '$timeout', 'windowStatus', function ($scope, $http, $timeout, windowStatus) {

        //Received messages
        $scope.messages = [];

        //Get message ID
        $scope.getMessageID = function (message) {
            return $scope.settings.channel + '_' + message.id;
        };

        //Current message
        $scope.submit = function () {
            if ($scope.content.length == '') {
                return;
            }

            //Compose and send message
            var message = {
                author: $scope.settings.sender,
                content: $scope.content,
                date: new Date / 1E3 | 0
            };
            if ($scope.replyingTo) {
                message.replyToID = $scope.replyingTo.id;
            }
            $scope.messages.push(message);
            $scope.sendMessage(message);

            //Clear content
            $scope.content = '';
            $scope.replyingTo = null;
        };

        //Send message
        $scope.sendMessage = function (message) {
            message.isSending = true;
            message.isError = false;

            $http.post($scope.settings.ajaxEndpoint, message, {
                params: {
                    method: 'submit'
                }
            }).
                success(function (data) {
                    message.isSending = false;
                    if (data.data) {
                        message.isError = false;
                        angular.extend(message, data.data);
                    }
                }).
                error(function () {
                    message.isSending = false;
                    message.isError = true;
                });
        };

        //Send on Enter
        $scope.messageKeyPress = function ($event) {
            if ($scope.settings.submitOnEnter && $event.keyCode == 13) {
                $scope.submit();
                $event.preventDefault();
                return false;
            }
        };

        //Reply messages
        $scope.replyingTo = null;
        $scope.reply = function (message) {
            $scope.replyingTo = message;
        };

        //Update messages loop
        var initialized = false, firstID, lastID = 0;
        $scope.$watch('settings', function (settings) {
            if (initialized) return;
            initialized = true;

            //Prepare new message sounds
            var audio = null;
            if ($scope.settings.soundOnNew) {
                if (angular.isString($scope.settings.soundOnNew)) {
                    audio = new Audio($scope.settings.soundOnNew);
                } else {
                    audio = document.createElement("audio");

                    angular.forEach($scope.settings.soundOnNew, function (url, mime) {
                        var source = document.createElement('source');
                        source.type = mime;
                        source.src = url;
                        audio.appendChild(source);
                    });
                }
            }

            //Receive messages
            var loadMessages = function (params, onFinish) {
                $scope.loading = true;
                $http.get($scope.settings.ajaxEndpoint, {
                    params: angular.extend({
                        method: 'messages',
                        since: lastID,
                        dir: 'ASC',
                        count: 25
                    }, params)
                }).success(function (data) {
                    if (data.data) {
                        //Read messages and lastID
                        var created = 0;
                        angular.forEach(data.data, function (message) {
                            //Check if message is duplicated
                            var duplicated = false;
                            angular.forEach($scope.messages, function (item) {
                                if (item.id && item.id == message.id) {
                                    duplicated = true;
                                }
                            });
                            if (duplicated) {
                                return;
                            }

                            //Save last and first ID
                            if (message.id > lastID) {
                                lastID = message.id;
                            }
                            if (message.id < firstID || angular.isUndefined(firstID)) {
                                firstID = message.id;
                            }

                            //Store message
                            $scope.messages.push(message);
                            created++;
                        });

                        //Play sound
                        if (created > 0 && audio && windowStatus.hidden) {
                            audio.play();
                        }

                        if (onFinish) {
                            onFinish(data);
                        }
                    }

                    $scope.loading = false;
                }).error(function () {
                    $scope.loading = false;

                    if (onFinish) {
                        onFinish(false);
                    }
                });
            };

            //Load previous messages when scrolling to top
            $scope.loadingOlder = false;
            $scope.disableOlder = false;
            $scope.onScroll = function (offset) {
                if (!$scope.disableOlder && offset == 0) {
                    console.log("Load old messages");
                    $scope.loadingOlder = true;
                    loadMessages({
                        since: firstID,
                        dir: 'DESC'
                    }, function (data) {
                        if (data.data.length == 0)//No more messages!
                        {
                            $scope.disableOlder = true;
                        }
                        $scope.loadingOlder = false;
                    });
                }
            };

            //Auto update messages
            var reload = function () {
                if (settings.updateInterval) {
                    $timeout(function () {
                        loadMessages({}, reload)
                    }, settings.updateInterval);
                }

            };
            loadMessages({}, reload);

            //Remove autoupdate interval
            $scope.$on('$destroy', function () {
                settings.updateInterval = false;
            });
        });

    }])
    .directive('angularTalkScroll', function () {
        return {
            priority: 1,
            scope: {
                onScroll: '&'
            },
            restrict: 'A',
            link: function ($scope, $el) {
                var el = $el[0], active = true;

                function scrollToBottom() {
                    el.scrollTop = el.scrollHeight;
                }

                function shouldActivateAutoScroll() {
                    // + 1 catches off by one errors in chrome
                    return el.scrollTop + el.clientHeight + 1 >= el.scrollHeight;
                }

                //Show message
                $scope.show = function (message) {
                    var m = document.getElementById($scope.getMessageID(message));
                    if (m) {
                        el.scrollTop = m.offsetTop;
                    }
                };

                $scope.$watch(function () {
                    if (active) {
                        scrollToBottom();
                    }
                });

                $el.bind('scroll', function () {
                    active = shouldActivateAutoScroll();

                    $scope.onScroll({offset: el.scrollTop});
                });
            }
        };
    })
    .service('windowStatus', function () {
        var status = {
            visible: true,
            hidden: false
        };
        var hiddenProp = "hidden";

        // Standards:
        if (hiddenProp in document)
            document.addEventListener("visibilitychange", onchange);
        else if ((hiddenProp = "mozHidden") in document)
            document.addEventListener("mozvisibilitychange", onchange);
        else if ((hiddenProp = "webkitHidden") in document)
            document.addEventListener("webkitvisibilitychange", onchange);
        else if ((hiddenProp = "msHidden") in document)
            document.addEventListener("msvisibilitychange", onchange);
        // IE 9 and lower:
        else if ("onfocusin" in document)
            document.onfocusin = document.onfocusout = onchange;
        // All others:
        else
            window.onpageshow = window.onpagehide
                = window.onfocus = window.onblur = onchange;

        function onchange(evt) {
            var evtMap = {
                focus: true,
                focusin: true,
                pageshow: true,
                blur: false,
                focusout: false,
                pagehide: false
            };

            evt = evt || window.event;
            if (evt.type in evtMap) {
                status.visible = evtMap[evt.type];
            }
            else {
                status.visible = this[hiddenProp] ? false : true;
            }
            status.hidden = !status.visible;
        }

        // set the initial state (but only if browser supports the Page Visibility API)
        if (document[hiddenProp] !== undefined) {
            onchange({type: document[hiddenProp] ? "blur" : "focus"});
        }

        return status;
    }).run(['windowStatus', function () {
        //Needed to execute windowStatus at startup
    }]);