<?php

/**
 * Conversation associated to a channel
 */
class AngularTalk_Room
{
    /**
     * Current message provider
     * @var AngularTalk_MessageProvider
     */
    protected $_provider;

    /**
     * Make the room work as a chat
     */
    const MODE_CHAT = 1;
    /**
     * Make the room work as a comment panel
     */
    const MODE_CONVERSATION = 2;

    /**
     * Channel ID
     * @var string
     */
    public $channel;

    /**
     * Current message sender
     * @var AngularTalk_Author
     */
    public $sender;

    /**
     * Show user names above their message
     * @var bool
     */
    public $showUserName;

    /**
     * Group messages by sent time
     * @var bool
     */
    public $groupMessages;

    /**
     * Reverse sender messages, moving it to the right
     * @var bool
     */
    public $reverseSenderMessages;

    /**
     * Allow new messages to be created
     * @var bool
     */
    public $allowNew = true;

    /**
     * If set, URL to the sound that will be played when there is a new message and the current document is not focused.
     * It also can be an array of URLs with multiple versions of the sound for different browsers, in the form array(mime_type => URL)
     * @var string|string[]
     */
    public $soundOnNew;

    /**
     * Show user faces in the message
     * @var bool
     */
    public $showFaces = true;

    /**
     * Show only approved messages by a moderator
     * @var bool
     */
    public $onlyApproved = true;

    /**
     * Allow replies to other messages that will be shown as a tree layout
     * @var bool
     */
    public $allowReplies = true;

    /**
     * Maximun number of reply levels allowed
     * @var int
     */
    public $replyLevels = 2;

    /**
     * Allow users submit a rating about something
     * @var bool
     */
    public $allowRating = false;

    /**
     * Ask sender name
     * @var bool
     */
    public $requireAuthorName = true;

    /**
     * Ask sender email
     * @var bool
     */
    public $requireAuthorEmail = true;

    /**
     * Ask sender URL
     * @var bool
     */
    public $requireAuthorURL = true;

    /**
     * Waiting time (in ms) between update requests
     * @var int
     */
    public $updateInterval;

    /**
     * Ajax endpoint called to update and submit messages
     * @var string
     */
    public $ajaxEndpoint;

    /**
     * Submit new message when Enter key is pressed
     * @var bool
     */
    public $submitOnEnter;

    /**
     * If enabled, verbose error messages and descriptions will be provided
     * @var bool
     */
    public $debug = false;

    /**
     * Strings used in the app
     * @var array
     */
    public $strings = array(
        'messagePlaceholder' => 'Enter your message...',
        'submit' => 'Submit',
        'reply' => 'Reply',
        'inReplyTo' => 'In reply to: ',
        'retrySend' => "This message didn't send. Check your internet connection and click to try again.",
        'edit' => 'Edit',
        'delete' => 'Delete',
        'save' => 'Save',
        'delete_confirm'=> 'Are you sure? This cannot be undone'
    );

    public function __construct($channel, AngularTalk_MessageProvider $provider)
    {
        $this->_provider = $provider;
        $this->channel = $channel;
        $this->set_mode(self::MODE_CHAT);
    }

    public function set_mode($mode)
    {
        switch ($mode) {
            case self::MODE_CHAT:
                $this->requireAuthorEmail = false;
                $this->requireAuthorName = false;
                $this->requireAuthorURL = false;
                $this->allowReplies = false;
                $this->updateInterval = 3000;
                $this->onlyApproved = false;
                $this->submitOnEnter = true;
                $this->showUserName = false;
                $this->groupMessages = true;
                $this->reverseSenderMessages = true;
                $this->soundOnNew = true;
                $this->showFaces = true;
                break;

            case self::MODE_CONVERSATION:
                $this->requireAuthorEmail = true;
                $this->requireAuthorName = true;
                $this->requireAuthorURL = true;
                $this->allowReplies = true;
                $this->updateInterval = 30000;
                $this->submitOnEnter = false;
                $this->showUserName = true;
                $this->groupMessages = false;
                $this->reverseSenderMessages = false;
                $this->soundOnNew = false;
                $this->showFaces = true;
                break;

            default:
                throw new InvalidArgumentException("Unrecognized room mode '$mode'");
        }
    }

    /**
     * Establece el objeto en modo de escucha para responder peticiones AJAX
     */
    public function listen()
    {
        $response = array(
            'status' => 'success'
        );

        $request = json_decode(file_get_contents('php://input'));

        try {
            switch (strtolower($_REQUEST['method'])) {
                case 'messages':
                    $since = isset($_REQUEST['since']) ? $_REQUEST['since'] : 0;
                    $dir = isset($_REQUEST['dir']) && $_REQUEST['dir'] == 'ASC' ? 'ASC' : 'DESC';
                    $count = isset($_REQUEST['count']) && is_numeric($_REQUEST['count']) ? $_REQUEST['count'] : 25;
                    $response['data'] = $this->_provider->get($this, $since, $dir, $count);
                    break;

                case 'submit':
                    if (!$this->allowNew) {
                        $response['message'] = 'New message submissions are not allowed';
                        throw new Exception;
                    }

                    $message = new AngularTalk_Message();
                    $message->channel = $this->channel;
                    $message->content = $request->content;
                    $message->date = time();
                    $message->approved = false;
                    $message->title = isset($request->title) ? $request->title : '';
                    $message->rating = isset($request->rating) && $this->allowRating ? $request->rating : 0;
                    $message->replyToID = isset($request->replyToID) && $this->allowReplies ? $request->replyToID : 0;

                    //Author info
                    $message->author = clone $this->sender;
                    if (isset($request->author->url) && $this->requireAuthorURL) {
                        $message->author->url = $request->author->url;
                    }
                    if (isset($request->author->name) && $this->requireAuthorName) {
                        $message->author->name = $request->author->name;
                    }
                    if (isset($request->author->email) && $this->requireAuthorEmail) {
                        $message->author->url = $request->author->email;
                    }


                    $response['data'] = $this->_provider->create($this, $message);
                    break;

                case 'update':
                    if (!$this->sender->isModerator) {
                        $response['message'] = 'Unauthorized';
                        throw new RuntimeException;
                    }

                    //Load current message
                    $message = $this->_provider->get($this, $request->id, 'ID');

                    if (!$message) {
                        $response['message'] = 'Invalid message ID';
                        throw new RuntimeException;
                    }

                    //Set message new values
                    $message->content = $request->content;

                    $response['data'] = $this->_provider->update($this, $message);

                    break;

                case 'delete':
                    if ($this->sender->isModerator) {
                        if (!$this->_provider->delete($this, $request->id)) {
                            $response['message'] = 'Delete error';
                            throw new InvalidArgumentException;
                        }
                    } else {
                        $response['message'] = 'Unauthorized';
                        throw new RuntimeException;
                    }
                    break;

                default:
                    $response['message'] = 'Unrecognized method';
                    throw new InvalidArgumentException;
            }
        } catch (Exception $err) {
            $response['status'] = 'error';
            if ($this->debug) {
                $response['message'] = $err->getMessage();
                $response['file'] = $err->getFile();
                $response['line'] = $err->getLine();
            }
        }

        //Output response
        if ($response['status'] != 'success') {
            header("HTTP/1.1 500");
        }

        header('Content-type: application/json');
        echo json_encode($response, JSON_NUMERIC_CHECK);
    }

    /**
     * Renderiza la sala de chat con los parámetros de la instancia actual
     * @return html
     */
    public function render()
    {
        $settings = get_object_vars($this);
        unset($settings['_provider']);

        ob_start();
        ?>
        <div
            class="angular-talk"
            ng-controller="AngularTalkController"
            ng-init="settings = <?= htmlspecialchars(json_encode($settings)) ?>">
            <div class="heading"></div>
            <div class="messages" angular-talk-scroll ng-class="{faces:settings.showFaces}" on-scroll="onScroll(offset)">
                <!-- Loader (when scrolling to top or empty messages) -->
                <div class="main-loader" ng-show="loadingOlder">
                    <span class="loader icon icon-circle-o-notch icon-spin fa fa-circle-o-notch fa-spin"></span>
                </div>

                <?= $this->_render_messages(0) ?>
            </div>
            <!-- Send panel -->
            <div class="footer">
                <div class="reply-to" ng-show="replyingTo">
                    {{::settings.strings.inReplyTo}} <a ng-click="show(replyingTo)">{{replyingTo.author.name}}</a>
                    <a class="cancel" ng-click="replyingTo=null">&times;</a>
                </div>
                <textarea
                    ng-model="content"
                    ng-keypress="messageKeyPress($event)"
                    rows="3" cols="1"
                    placeholder="{{::settings.strings.messagePlaceholder}}"></textarea>

                <div style="text-align: right">
                    <button type="button" class="submit" ng-click="submit()" ng-disabled="!content">{{editingMessage ? settings.strings.save : settings.strings.submit}}
                    </button>
                </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    private function _render_messages($level, $in_reply_to = 0)
    {
        ?>
        <!-- Moment separator (every 30min) -->
        <div
            ng-repeat-start="message in (filteredMessages = (messages <?= $this->allowReplies ? '| filter:{replyToID:' . $in_reply_to . '}:true' : '' ?> | orderBy:'+date'))"
            class="moment"
            ng-show="settings.groupMessages && ($index==0 || (message.date-filteredMessages[$index - 1].date)>30000)">
            <time class="relative" datetime="{{::message.date*1000 | date:'yyyy-MM-dd HH:mm:ss Z'}}">{{::message.date*1000 | date:'medium'}}</time>
        </div>

        <!-- Message content -->
        <div ng-repeat-end class="message" id="{{getMessageID(message)}}" ng-class="{
                'from-sender': message.author.id==settings.sender.id,
                reversed:settings.reverseSenderMessages && message.author.id==settings.sender.id,
                active:message.isActive,
                error:message.isError}" ng-click="message.isActive=!message.isActive">

            <!-- Icon -->
            <a ng-show="settings.showFaces" class="message-img" ng-href="{{::message.author.href}}" title="{{::message.author.name}}">
                <img ng-src="{{::message.author.icon}}" alt="{{::message.author.name}}">
            </a>

            <!-- Message body -->
            <div class="message-wrapper">
                <div class="message-body" title="{{::message.date*1000 | date:'medium'}}">
                    {{message.content}}
                    <div class="message-info" ng-show="!settings.groupMessages || message.isActive || message.isSending || message.isError">
                        <!-- Error -->
                              <span ng-show="message.isError">
                                    <a class="retry-send" ng-click="sendMessage(message)">
                                        <i class="icon icon-warning fa fa-warning"></i>
                                        {{::settings.strings.retrySend}}
                                    </a>
                                    <span class="bullet">•</span>
                                </span>

                        <!-- Loader -->
                           <span ng-show="message.isSending">
                                    <span class="loader icon icon-circle-o-notch icon-spin fa fa-circle-o-notch fa-spin"></span>
                                    <span class="bullet">•</span>
                           </span>

                        <!-- Author -->
                                <span ng-show="settings.showUserName">
                                    <a class="author" ng-href="{{::message.author.href}}">
                                        {{::message.author.name}}
                                    </a>
                                    <span class="bullet">•</span>
                                </span>

                        <!-- Reply -->
                        <?php if ($level < $this->replyLevels - 1): ?>
                            <span ng-show="settings.allowReplies && message.id">
                                <a class="reply" ng-click="reply(message)">
                                    <i class="icon icon-reply fa fa-reply"></i>
                                    {{::settings.strings.reply}}
                                </a>
                                <span class="bullet">•</span>
                              </span>
                        <?php endif; ?>

                        <!-- Edit -->
                         <span ng-show="settings.sender.isModerator">
                                <a class="edit" ng-click="edit(message)">
                                    <i class="icon icon-edit fa fa-edit"></i>
                                    {{::settings.strings.edit}}
                                </a>
                                <span class="bullet">•</span>
                                <a class="delete" ng-click="delete(message)">
                                    <i class="icon icon-remove fa fa-remove"></i>
                                    {{::settings.strings.delete}}
                                </a>
                                <span class="bullet">•</span>
                              </span>

                        <!-- Date -->
                        <time class="relative" datetime="{{::message.date*1000 | date:'yyyy-MM-dd HH:mm:ss Z'}}">{{::message.date*1000 | date:'medium'}}</time>
                    </div>

                </div>

                <?php if ($this->allowReplies && $level < $this->replyLevels - 1): ?>
                    <?= $this->_render_messages($level + 1, 'message.id') ?>
                <?php endif; ?>
            </div>
        </div>
    <?php
    }
}