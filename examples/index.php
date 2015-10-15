<?php
require '../vendor/autoload.php';
require 'libs/DummyProvider.php';

$provider = new DummyProvider();
$chat = new AngularTalk_Room('chat', $provider);
$chat->set_mode(AngularTalk_Room::MODE_CHAT);
$chat->ajaxEndpoint = '?chatEndpoint';
$chat->sender = $provider->authorInfo(1, $chat);
$chat->sender->isModerator = true;
$chat->soundOnNew = array(
    'audio/mpeg' => 'static/notification.mp3',
    'audio/ogg'  => 'static/notification.ogg'
);
$chat->debug = true;

$commentProvider = new DummyProvider();
$commentProvider->replies = true;
$comments = new AngularTalk_Room('comments', $commentProvider);
$comments->set_mode(AngularTalk_Room::MODE_CONVERSATION);
$comments->ajaxEndpoint = '?commentsEndpoint';
$comments->sender = $provider->authorInfo(1, $comments);
$comments->sender->isModerator = true;
$comments->debug = true;


if (isset($_GET['chatEndpoint'])) {
    $chat->listen();
    return;
}
if (isset($_GET['commentsEndpoint'])) {
    $comments->listen();
    return;
}
?>
<!DOCTYPE html>
<html lang="en" ng-app="angularTalk">
<head>
    <meta charset="utf-8">
    <title>angular-talk</title>

    <link href="static/example.css" rel="stylesheet"/>
    <link href="../dist/css/angular-talk.min.css" rel="stylesheet"/>
    <link href="//maxcdn.bootstrapcdn.com/font-awesome/4.2.0/css/font-awesome.min.css" rel="stylesheet"/>

</head>

<body>

<div class="container">

    <div class="page-header">
        <h1>angular-talk</h1>
    </div>
    <blockquote>
        Nice chat and comments engine written with PHP and Angular
    </blockquote>
    <h2>Chat room</h2>

    <div id="chat">
        <?php
        echo $chat->render();
        ?>
    </div>

    <h2>Comments engine</h2>

    <div id="comments">
        <?php
        echo $comments->render();
        ?></div>

    <h2>Comments engine (Read Only)</h2>

    <div id="comments">
        <?php
        $comments->readOnly=true;
        echo $comments->render();
        ?></div>
</div>

<script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.4.7/angular.min.js"></script>
<script src="../dist/js/angular-talk.tpls.js"></script>
</body>
</html>
