/**
 * angular-talk
 * Chat and comments engine
 *
 * @author Javier Marín <contacto@ideatic.net>
 */
'use strict';

angular.module('angularTalk', [])
    .directive('angularTalk', ['$http', '$timeout', 'windowStatus', function ($http, $timeout, windowStatus) {
        return {
            restrict: 'AC',
            scope: true,
            templateUrl: 'angularTalk/room.html',
            link: function ($scope, $element, $attributes) {
                //Load settings
                var settings = $scope.settings = {};
                angular.forEach($attributes, function (val, name) {
                    if (val == '') {
                        $scope.settings[name] = true;
                    } else if (['strings', 'sender', 'soundOnNew'].indexOf(name) >= 0) {
                        $scope.settings[name] = $scope.$eval(val);
                    } else {
                        $scope.settings[name] = val;
                    }
                });

                if (!settings.ajaxEndpoint) {
                    throw new Error('Invalid ajax endpoint');
                }

                //Received messages
                $scope.messages = [];

                //Current message
                $scope.message = {};

                //Save message
                $scope.save = function save(message) {
                    message.isSending = true;
                    message.isError = false;
                    message.isEditing = false;

                    //Build params
                    var postParams = {};
                    angular.forEach(message, function (v, k) {
                        if (k[0] != '$' && k.indexOf('is') !== 0) {
                            postParams[k] = v;
                        }
                    });

                    $http.post(settings.ajaxEndpoint, postParams, {
                        params: {
                            method: message.id ? 'update' : 'submit'
                        }
                    }).success(function (data) {
                        message.isSending = false;
                        if (data.data) {
                            message.isError = false;
                            angular.extend(message, data.data);

                            $scope.$emit('messageSend', message)
                        }
                    }).error(function () {
                        message.isSending = false;
                        message.isError = true;
                    });

                    //Clear content
                    $scope.content = '';
                };

                $scope.submit = function submit(message) {
                    message = angular.extend(message, {
                        author: settings.sender,
                        date: new Date / 1E3 | 0
                    });

                    $scope.messages.push(message);
                    $scope.save(message);

                    $scope.message = {};
                };


                //Send on Enter
                $scope.messageKeyPress = function messageKeyPress($event) {
                    if (settings.submitOnEnter && $event.keyCode == 13) {
                        $scope.submit();
                        $event.preventDefault();
                        return false;
                    }
                };

                //Reply messages
                $scope.reply = function reply(message) {
                    message.$replies.push({
                        author: settings.sender,
                        isEditing: true,
                        content: '',
                        date: new Date / 1E3 | 0,
                        replyToID: message.id
                    });
                };

                //Edit message
                $scope.edit = function edit(message) {
                    message.isEditing = true;
                };

                //Delete message
                $scope.delete = function deleteFn(message) {
                    if (confirm(settings.strings.delete_confirm)) {
                        $http.post(settings.ajaxEndpoint, message, {
                            params: {
                                method: 'delete'
                            }
                        }).success(function () {
                            function deleteInCollection(item, collection) {
                                var i = collection.indexOf(item);
                                if (i >= 0) {
                                    collection.splice(i, 1);
                                }
                                angular.forEach(collection, function (m) {
                                    if (m.$replies) {
                                        deleteInCollection(item, m.$replies);
                                    }
                                });
                            }

                            deleteInCollection(message, $scope.messages);

                        });
                    }
                };

                //Previous message
                $scope.previousMessage = function previousMessage(reference) {
                    var previous = undefined;
                    angular.forEach($scope.messages, function previousMessageIterator(m) {
                        if (m.replyToID == reference.replyToID && m.id != reference.id && m.date <= reference.date) {
                            if (!previous || previous.date < m.date) {
                                previous = m;
                            }
                        }
                    });
                    return previous;
                };

                //Update messages loop
                var firstID, lastID = 0;

                //Prepare new message sounds
                var audio = null;
                if (settings.soundOnNew) {
                    if (angular.isString(settings.soundOnNew)) {
                        audio = new Audio(settings.soundOnNew);
                    } else {
                        audio = document.createElement("audio");

                        angular.forEach(settings.soundOnNew, function (url, mime) {
                            var source = document.createElement('source');
                            source.type = mime;
                            source.src = url;
                            audio.appendChild(source);
                        });
                    }
                }

                //Receive messages
                function findMessageByID(id, messages) {
                    var found = false;
                    angular.forEach(messages || $scope.messages, function messageFinder(m) {
                        if (m.id && m.id == id) {
                            found = m;
                        }
                        if (!found && m.$replies) {
                            found = findMessageByID(id, m.$replies);
                        }
                    });
                    return found;
                };

                function appendMessage(message) {
                    if (message.id) {
                        //Check if message is duplicated
                        if (findMessageByID(message.id)) {
                            return;
                        }

                        //Save last and first ID
                        if (message.id > lastID) {
                            lastID = message.id;
                        }
                        if (message.id < firstID || angular.isUndefined(firstID)) {
                            firstID = message.id;
                        }
                    }

                    //Add to message tree
                    message.$replies = [];
                    if (message.replyToID) {
                        var parent = findMessageByID(message.replyToID);
                        if (parent) {
                            parent.$replies.push(message);
                        }
                    } else {
                        $scope.messages.push(message);
                    }

                    $scope.$emit('messageReceived', message);
                }

                function loadMessages(params, onFinish, first) {
                    $scope.loading = true;
                    $http.get(settings.ajaxEndpoint, {
                        params: angular.extend({
                            method: 'messages',
                            since: lastID,
                            dir: 'ASC',
                            count: 25
                        }, params)
                    }).success(function onMessagesReceived(data) {
                        if (data.data) {
                            //Read messages and lastID
                            angular.forEach(data.data, appendMessage);

                            //Play sound
                            if (data.data.length > 0 && audio && windowStatus.hidden) {
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
                }

                //Load previous messages when scrolling to top
                $scope.loadingOlder = false;
                $scope.disableOlder = false;
                $scope.onScroll = function onScroll(offset) {
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
                var reload = function reload() {
                    if ($scope.settings.updateInterval) {
                        $timeout(function () {
                            loadMessages({}, reload)
                        }, $scope.settings.updateInterval);
                    }

                };
                loadMessages({}, reload, true);

                //Remove autoupdate interval
                $scope.$on('$destroy', function () {
                    $scope.settings.updateInterval = false;
                });
            }
        };
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
    .directive('init', function () {
        return {
            priority: 0,
            compile: function () {
                return {
                    pre: function initDirective(scope, element, attrs) {
                        scope.$eval(attrs.init);
                    }
                };
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