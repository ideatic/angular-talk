/**
 * angular-talk
 * Chat and comments engine
 *
 * @author Javier Marín <contacto@ideatic.net>
 */
'use strict';

angular.module('angular-talk', [])
    .directive('angularTalk', ['$http', '$timeout', 'windowStatus', function ($http, $timeout, windowStatus) {
        return {
            restrict: 'AC',
            scope: {},
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

                //Get message ID
                $scope.getMessageID = function getMessageID(message) {
                    return settings.channel + '_' + message.id;
                };

                //Current message
                $scope.submit = function submit() {
                    if ($scope.content.length == '') {
                        return;
                    }

                    //Compose and send message
                    var message;
                    if ($scope.editingMessage) {
                        message = $scope.editingMessage;
                        message.content = $scope.content;
                        $scope.editingMessage = null;
                    } else {
                        message = {
                            author: settings.sender,
                            content: $scope.content,
                            date: new Date / 1E3 | 0
                        };
                        if ($scope.replyingTo) {
                            message.replyToID = $scope.replyingTo.id;
                        }
                        $scope.messages.push(message);
                    }

                    $scope.sendMessage(message);

                    //Clear content
                    $scope.content = '';
                    $scope.replyingTo = null;
                };

                //Send message
                $scope.sendMessage = function sendMessage(message) {
                    message.isSending = true;
                    message.isError = false;

                    $http.post(settings.ajaxEndpoint, message, {
                        params: {
                            method: message.id ? 'update' : 'submit'
                        }
                    }).
                        success(function (data) {
                            message.isSending = false;
                            if (data.data) {
                                message.isError = false;
                                angular.extend(message, data.data);

                                $scope.$emit('messageSend', message)
                            }
                        }).
                        error(function () {
                            message.isSending = false;
                            message.isError = true;
                        });
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
                $scope.replyingTo = null;
                $scope.reply = function reply(message) {
                    $scope.replyingTo = message;
                };
                $scope.getReplies = function (toID) {
                    var messages = [];
                    angular.forEach($scope.messages, function (m) {
                        if (m.replyToID == toID) {
                            messages.push(m);
                        }
                    });
                    return messages;
                };

                //Edit message
                $scope.editingMessage = null;
                $scope.edit = function edit(message) {
                    $scope.editingMessage = message;
                    $scope.content = message.content;
                };

                //Delete message
                $scope.delete = function deleteFn(message) {
                    if (confirm(settings.strings.delete_confirm)) {
                        $http.post(settings.ajaxEndpoint, message, {
                            params: {
                                method: 'delete'
                            }
                        }).
                            success(function () {
                                var i = $scope.messages.indexOf(message);
                                if (i >= 0) {
                                    $scope.messages.splice(i, 1);
                                }
                            });
                    }
                };

                //Previous message
                $scope.previousMessage = function (reference) {
                    var previous = undefined;
                    angular.forEach($scope.messages, function (m) {
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
                var loadMessages = function loadMessages(params, onFinish, first) {
                    $scope.loading = true;
                    $http.get(settings.ajaxEndpoint, {
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
                                if (!first) {
                                    $scope.$emit('messageReceived', message);
                                }
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

                //Show message
                $scope.show = function showMessage(message) {
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

angular.module("angular-talk").run(["$templateCache", function($templateCache) { 
$templateCache.put("angularTalk\/messages.html","<div\nng-repeat-start=\"message in (listingMessages = (filteredMessages || (settings.allowReplies ? getReplies(0) : messages)) | orderBy:'+date')\"\nclass=\"moment\"\nng-show=\"settings.groupMessages && ($index==0 || (message.date - previousMessage(message).date)>30000)\">\n<time\nclass=\"relative\" datetime=\"{{::message.date*1000 | date:'yyyy-MM-dd HH:mm:ss Z'}}\">{{::message.date*1000 | date:'medium'}}<\/time><\/div><div\nng-repeat-end class=\"message\" id=\"{{getMessageID(message)}}\" ng-class=\"{\n'from-sender': message.author.id==settings.sender.id,\nreversed:settings.reverseSenderMessages && message.author.id==settings.sender.id,\nactive:message.isActive,\nerror:message.isError}\" ng-click=\"message.isActive=!message.isActive\">\n<a\nng-show=\"settings.showFaces\" class=\"message-img\" ng-href=\"{{::message.author.href}}\" title=\"{{::message.author.name}}\">\n<img\nng-src=\"{{::message.author.icon}}\" alt=\"{{::message.author.name}}\">\n<\/a><div\nclass=\"message-wrapper\"><div\nclass=\"message-body\" title=\"{{::message.date*1000 | date:'medium'}}\">\n{{message.content}}<div\nclass=\"message-info\" ng-show=\"!settings.groupMessages || message.isActive || message.isSending || message.isError\">\n<span\nng-show=\"message.isError\">\n<a\nclass=\"retry-send\" ng-click=\"sendMessage(message)\">\n<i\nclass=\"icon icon-warning fa fa-warning\"><\/i>\n{{::settings.strings.retrySend}}\n<\/a>\n<span\nclass=\"bullet\">\u2022<\/span>\n<\/span>\n<span\nng-show=\"message.isSending\">\n<span\nclass=\"loader icon icon-circle-o-notch icon-spin fa fa-circle-o-notch fa-spin\"><\/span>\n<span\nclass=\"bullet\">\u2022<\/span>\n<\/span>\n<span\nng-show=\"settings.showUserName\">\n<a\nclass=\"author\" ng-href=\"{{::message.author.href}}\">\n{{::message.author.name}}\n<\/a>\n<span\nclass=\"bullet\">\u2022<\/span>\n<\/span>\n<span\nng-show=\"replyLevel < settings.replyLevels-1 && settings.allowReplies && message.id\">\n<a\nclass=\"reply\" ng-click=\"reply(message)\">\n<i\nclass=\"icon icon-reply fa fa-reply\"><\/i>\n{{::settings.strings.reply}}\n<\/a>\n<span\nclass=\"bullet\">\u2022<\/span>\n<\/span>\n<span\nng-show=\"settings.sender.isModerator\">\n<a\nclass=\"edit\" ng-click=\"edit(message)\">\n<i\nclass=\"icon icon-edit fa fa-edit\"><\/i>\n{{::settings.strings.edit}}\n<\/a>\n<span\nclass=\"bullet\">\u2022<\/span>\n<a\nclass=\"delete\" ng-click=\"delete(message)\">\n<i\nclass=\"icon icon-remove fa fa-remove\"><\/i>\n{{::settings.strings.delete}}\n<\/a>\n<span\nclass=\"bullet\">\u2022<\/span>\n<\/span>\n<time\nclass=\"relative\" datetime=\"{{::message.date*1000 | date:'yyyy-MM-dd HH:mm:ss Z'}}\">{{::message.date*1000 | date:'medium'}}<\/time><\/div><\/div>\n<ng-include\nng-if=\"settings.allowReplies && replyLevel < settings.replyLevels-1 && (filteredMessages = getReplies(message.id)).length>0\"\nsrc=\"'angularTalk\/messages.html'\"\nng-init=\"replyLevel=replyLevel+1\"><\/ng-include><\/div><\/div>");
$templateCache.put("angularTalk\/room.html","<div\nclass=\"messages\" angular-talk-scroll ng-class=\"{faces:settings.showFaces}\" on-scroll=\"onScroll(offset)\"><div\nclass=\"main-loader\" ng-show=\"loadingOlder\">\n<span\nclass=\"loader icon icon-circle-o-notch icon-spin fa fa-circle-o-notch fa-spin\"><\/span><\/div><ng-include\nsrc=\"'angularTalk\/messages.html'\" ng-init=\"replyLevel=0\"><\/ng-include><\/div><div\nclass=\"footer\"><div\nclass=\"reply-to\" ng-show=\"replyingTo\">\n{{::settings.strings.inReplyTo}} <a\nng-click=\"show(replyingTo)\">{{replyingTo.author.name}}<\/a>\n<a\nclass=\"cancel\" ng-click=\"replyingTo=null\">&times;<\/a><\/div><textarea\n                        ng-model=\"content\"\n                        ng-keypress=\"messageKeyPress($event)\"\n                        rows=\"3\" cols=\"1\"\n                        placeholder=\"{{::settings.strings.messagePlaceholder}}\"><\/textarea><div\nstyle=\"text-align: right\">\n<button\ntype=\"button\" class=\"submit\" ng-click=\"submit()\" ng-disabled=\"!content\">{{editingMessage ? settings.strings.save : settings.strings.submit}}\n<\/button><\/div><\/div>");
}]);