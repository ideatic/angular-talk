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
            scope: {
                settings: '='
            },
            templateUrl: 'angularTalk/room.html',
            link: function ($scope, $element, $attributes) {
                var settings = $scope.settings;

                if (!settings.ajaxEndpoint) {
                    throw new Error('Invalid ajax endpoint');
                }

                //Received messages
                $scope.messages = [];

                //Current message
                $scope.message = {};

                //Load message
                var waitingParent = {};

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
                        waitingParent[message.id] = message;
                    } else {
                        $scope.messages.push(message);
                    }

                    //Find pending parents
                    do {
                        var found = 0;
                        angular.forEach(waitingParent, function (waiting, id) {
                            var parent = findMessageByID(waiting.replyToID);
                            if (parent) {
                                parent.$replies.push(waiting);
                                delete waitingParent[id];
                                found++;
                            }
                        });
                    } while (found > 0);

                    $scope.$emit('messageReceived', message);
                }

                //Save message
                $scope.save = function save(message) {
                    message.isSending = true;
                    message.isError = false;
                    message.isEditing = false;

                    //Build body
                    var httpBody = {};
                    angular.forEach(message, function (v, k) {
                        if (k[0] != '$' && k.indexOf('is') !== 0) {
                            httpBody[k] = v;
                        }
                    });

                    $http[message.id ? 'put' : 'post'](settings.ajaxEndpoint, httpBody).then(function (httpResponse) {
                        message.isSending = false;
                        if (httpResponse.data) {
                            message.isError = false;
                            angular.extend(message, httpResponse.data.data);

                            $scope.$emit('messageSend', message)
                        }
                    }, function () {
                        message.isSending = false;
                        message.isError = true;
                    });

                    //Clear content
                    $scope.content = '';
                };

                $scope.submit = function submit() {
                    if (!$scope.message.content)return;

                    var message = angular.extend($scope.message, {
                        author: settings.sender,
                        date: new Date / 1000 | 0
                    });

                    appendMessage(message);
                    $scope.save(message);

                    $scope.message = {};
                };


                //Send on Enter
                $scope.current = {};
                $scope.messageKeyPress = function messageKeyPress($event) {
                    if (settings.submitOnEnter && $event.keyCode == 13) {
                        $scope.submit();
                        $event.preventDefault();
                        return false;
                    } else if ($event.keyCode == 27) {
                        //Cancel reply
                        $scope.cancelEdit($scope.current.message);
                        $scope.current.message = null;
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
                    message.originalContent = message.content;
                };

                $scope.cancelEdit = function cancelEdit(message) {
                    message.isEditing = false;
                    message.content = message.originalContent;
                    if (!message.id) {
                        $scope.delete(message);
                    }
                };

                //Delete message

                function addParam(url, key, value) {
                    if (url.indexOf('?') >= 0) {
                        if (url.substring(0, url.length - 1) !== '&') {
                            url += '&';
                        }
                    } else {
                        url += '?';
                    }

                    url += encodeURIComponent(key) + '=' + encodeURIComponent(value);
                    return url;
                }

                $scope.delete = function deleteFn(message) {
                    function removeFromListing() {
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
                    }

                    if (!message.id) {
                        removeFromListing();
                    } else if (confirm(settings.strings.delete_confirm)) {
                        $http.delete(addParam(settings.ajaxEndpoint, 'id', message.id)).then(removeFromListing);
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
                }

                function loadMessages(params, onFinish) {
                    $scope.loading = true;
                    $http.get(settings.ajaxEndpoint, {
                        params: angular.extend({
                            since: firstID,
                            dir: 'DESC',
                            count: 25
                        }, params)
                    }).then(function onMessagesReceived(httpResponse) {
                        if (httpResponse.data) {
                            //Read messages and lastID
                            angular.forEach(httpResponse.data.data, appendMessage);

                            //Play sound
                            if (httpResponse.data.data.length > 0 && audio && windowStatus.hidden) {
                                audio.play();
                            }

                            if (onFinish) {
                                onFinish(httpResponse.data);
                            }
                        }

                        $scope.loading = false;
                    }, function () {
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
                        }, function (response) {
                            if (response.data.length == 0)//No more messages!
                            {
                                $scope.disableOlder = true;
                            }
                            $scope.loadingOlder = false;
                        });
                    }
                };

                //Auto update messages
                function reload() {
                    if (settings.updateInterval) {
                        $timeout(function () {
                            loadMessages({}, reload)
                        }, settings.updateInterval);
                    }

                }

                loadMessages({}, reload);

                //Remove autoupdate interval
                $scope.$on('$destroy', function () {
                    settings.updateInterval = false;
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

angular.module("angularTalk").run(["$templateCache", function($templateCache) { 
$templateCache.put("angularTalk\/messages.html","<div\nng-repeat-start=\"message in messages | orderBy:'+date' track by message.id || $id(message)\"\nclass=\"moment\"\nng-show=\"settings.groupMessages && ($index==0 || (message.date - previousMessage(message).date)>30000)\">\n<time\nclass=\"relative\" datetime=\"{{ ::message.date*1000 | date:'yyyy-MM-dd HH:mm:ss Z' }}\">{{ ::message.date*1000 | date:'medium' }}<\/time><\/div><div\nng-repeat-end class=\"message\" ng-class=\"{\n'from-sender': message.author.id==settings.sender.id,\nreversed:settings.reverseSenderMessages && message.author.id==settings.sender.id,\nactive:message.isActive,\nerror:message.isError}\" ng-click=\"message.isActive=!message.isActive\">\n<a\nng-show=\"settings.showFaces\" class=\"message-img\" ng-href=\"{{::message.author.href}}\" title=\"{{::message.author.name}}\">\n<img\nng-src=\"{{::message.author.icon}}\" alt=\"{{::message.author.name}}\">\n<\/a><div\nclass=\"message-wrapper\"><div\nclass=\"message-body\" title=\"{{ ::message.date*1000 | date:'medium' }}\"><div\nng-hide=\"message.isEditing\">\n{{ message.content }}<div\nclass=\"message-info\" ng-show=\"!settings.groupMessages || message.isActive || message.isSending || message.isError\">\n<span\nng-show=\"message.isError\">\n<a\nclass=\"retry-send\" ng-click=\"save(message)\">\n<i\nclass=\"icon icon-warning fa fa-warning\"><\/i>\n{{ ::settings.strings.retrySend }}\n<\/a>\n<span\nclass=\"bullet\">\u2022<\/span>\n<\/span>\n<span\nng-show=\"message.isSending\">\n<span\nclass=\"loader icon icon-circle-o-notch icon-spin fa fa-circle-o-notch fa-spin\"><\/span>\n<span\nclass=\"bullet\">\u2022<\/span>\n<\/span>\n<span\nng-show=\"::settings.showUserName\">\n<a\nclass=\"author\" ng-href=\"{{ ::message.author.href }}\">\n{{ ::message.author.name }}\n<\/a>\n<span\nclass=\"bullet\">\u2022<\/span>\n<\/span>\n<span\nng-show=\"::replyLevel < settings.replyLevels-1 && settings.allowReplies && message.id && !settings.readOnly\">\n<a\nclass=\"reply\" ng-click=\"reply(message)\" title=\"{{ ::settings.strings.reply }}\">\n<i\nclass=\"icon icon-reply fa fa-reply\"><\/i>\n<span\nclass=\"text-info\">{{ ::settings.strings.reply }}<\/span>\n<\/a>\n<span\nclass=\"bullet\">\u2022<\/span>\n<\/span>\n<span\nng-show=\"::settings.sender.isModerator || message.author.id == settings.sender.id\">\n<a\nclass=\"edit\" ng-click=\"edit(message)\" title=\"{{ ::settings.strings.edit }}\">\n<i\nclass=\"icon icon-edit fa fa-edit\"><\/i>\n<span\nclass=\"text-info\">{{ ::settings.strings.edit }}<\/span>\n<\/a>\n<span\nclass=\"bullet\">\u2022<\/span>\n<a\nclass=\"delete\" ng-click=\"delete(message)\" title=\"{{ ::settings.strings.delete }}\">\n<i\nclass=\"icon icon-remove fa fa-remove\"><\/i>\n<span\nclass=\"text-info\">{{ ::settings.strings.delete }}<\/span>\n<\/a>\n<span\nclass=\"bullet\">\u2022<\/span>\n<\/span>\n<time\nclass=\"relative\" datetime=\"{{::message.date*1000 | date:'yyyy-MM-dd HH:mm:ss Z'}}\">{{::message.date*1000 | date:'medium'}}<\/time><\/div><\/div><div\nng-if=\"message.isEditing\"><textarea ng-model=\"message.content\"\n                       ng-keyup=\"messageKeyPress($event)\"\n                       ng-focus=\"current.message = message\"\n                       placeholder=\"{{ ::settings.strings.messagePlaceholder }}\"><\/textarea><div\nclass=\"tools\">\n<a\nng-click=\"cancelEdit(message)\">{{ ::settings.strings.cancel }}<\/a><button\ntype=\"button\" class=\"submit\" ng-click=\"save(message)\" ng-disabled=\"!message.content\">\n{{ message.id ? settings.strings.save : settings.strings.submit }}\n<\/button><\/div><\/div><\/div>\n<ng-include\nng-if=\"message.$replies.length>0 && settings.allowReplies && replyLevel < settings.replyLevels-1\"\nsrc=\"'angularTalk\/messages.html'\"\ninit=\"messages = message.$replies; replyLevel = replyLevel+1\"><\/ng-include><\/div><\/div>");
$templateCache.put("angularTalk\/room.html","<div\nclass=\"messages\" angular-talk-scroll ng-class=\"{faces:settings.showFaces}\" on-scroll=\"onScroll(offset)\"><div\nclass=\"main-loader\" ng-show=\"loadingOlder\">\n<span\nclass=\"loader icon icon-circle-o-notch icon-spin fa fa-circle-o-notch fa-spin\"><\/span><\/div><div\nclass=\"empty-room\" ng-show=\"messages.length==0\">{{ ::settings.strings.emptyRoom }}<\/div>\n<ng-include\nsrc=\"'angularTalk\/messages.html'\" init=\"messages = messages; replyLevel = 0\"><\/ng-include><\/div><div\nclass=\"footer\" ng-if=\"!settings.readOnly\"><textarea ng-model=\"message.content\"\n              ng-keyup=\"messageKeyPress($event)\"\n              rows=\"3\" cols=\"1\"\n              placeholder=\"{{ ::settings.strings.messagePlaceholder }}\"><\/textarea><div\nstyle=\"text-align: right\">\n<button\ntype=\"button\" class=\"submit\" ng-click=\"submit(message)\" ng-disabled=\"!message.content\">\n{{message.id ? settings.strings.save : settings.strings.submit}}\n<\/button><\/div><\/div>");
}]);