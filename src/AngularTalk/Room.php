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
     * Room is in read only mode
     * @var bool
     */
    public $readOnly = false;

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
    public $strings = [
        'messagePlaceholder' => 'Enter your message...',
        'submit'             => 'Submit',
        'reply'              => 'Reply',
        'retrySend'          => "This message didn't send. Check your internet connection and click to try again.",
        'emptyRoom'          => '',
        'edit'               => 'Edit',
        'delete'             => 'Delete',
        'save'               => 'Save',
        'cancel'             => 'Cancel',
        'delete_confirm'     => 'Are you sure? This cannot be undone'
    ];

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
     * Listen for AngularTalk request
     *
     * @param object    $request    HTTP request body, null to get it from 'php://input'
     * @param int       $message_id ID of the current message, null to get it from request
     * @param bool|true $echo       Send response automatically
     *
     * @return array
     */
    public function listen($request = null, $message_id = null, $echo = true)
    {
        $response = [];


        $http_code = 200;
        try {
            if (!$request) {
                $request_body = file_get_contents('php://input');
                if ($request_body) {
                    $request = json_decode($request_body);
                    if ($request === null) {
                        throw new AngularTalk_RoomException('Invalid request data', 400);
                    }
                } else {
                    $request = null;
                }
            }

            $method = strtoupper($_SERVER['REQUEST_METHOD']);
            switch ($method) {
                case 'GET':
                    $dir = isset($_REQUEST['dir']) && $_REQUEST['dir'] == 'ASC' ? 'ASC' : 'DESC';
                    $since = isset($_REQUEST['since']) ? $_REQUEST['since'] : null;
                    $count = isset($_REQUEST['count']) && is_numeric($_REQUEST['count']) ? $_REQUEST['count'] : 25;
                    $response['data'] = $this->_provider->get($this, $since, $dir, $count);
                    break;

                case 'POST':
                    if (!$this->allowNew) {
                        throw new AngularTalk_RoomException('New message submissions is not allowed', 403);
                    }
                    if (!$request) {
                        throw new AngularTalk_RoomException('Invalid request data', 400);
                    }

                    $message = new AngularTalk_Message();
                    $message->channel = $this->channel;
                    $message->content = $request->content;
                    $message->date = time();
                    $message->approved = false;
                    $message->title = isset($request->title) ? $request->title : '';
                    $message->rating = isset($request->rating) && $this->allowRating ? $request->rating : 0;
                    $message->replyToID = isset($request->replyToID) && $this->allowReplies ? $request->replyToID : null;

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
                    $http_code = 201;
                    break;

                case 'PUT':
                case 'DELETE':
                    //Load current message
                    $id = $message_id;
                    if (!$id) {
                        $id = $request && is_object($request) ? $request->id : $_REQUEST['id'];
                    }

                    $message = $id ? $this->_provider->get($this, $id, 'ID') : false;

                    if (!$message) {
                        throw new AngularTalk_RoomException('Message not found', 404);
                    }

                    if (!($this->sender->isModerator || $message->author->id == $this->sender->id)) {
                        throw new AngularTalk_RoomException('Not authorized to this operation', 403);
                    }

                    if ($method == 'PUT') {
                        //Update message
                        $message->content = $request->content;

                        $response['data'] = $this->_provider->update($this, $message);
                    } elseif (!$this->_provider->delete($this, $message->id)) {
                        //Delete message
                        throw new AngularTalk_RoomException('Delete error', 500);
                    }

                    break;

                default:
                    throw new AngularTalk_RoomException('Unrecognized method', 400);
            }
        } catch (Exception $err) {
            if ($this->debug) {
                $response['message'] = $err->getMessage();
                $response['file'] = $err->getFile();
                $response['line'] = $err->getLine();
            }
        }

        if (isset($err)) {
            $http_code = $err instanceof AngularTalk_RoomException ? $err->getCode() : 500;
        }
        $response['status'] = $http_code;

        if ($echo) {
            //Output response
            header("HTTP/1.1 " . $http_code);
            header('Content-type: application/json');
            echo json_encode($response, JSON_NUMERIC_CHECK);
        }

        return $response;
    }

    /**
     * Deletes the current room and all its associated messages
     */
    public function delete()
    {
        return $this->_provider->delete($this);
    }

    /**
     * Get the current room config for the angularTalk directive
     * @return array
     */
    public function get_config()
    {
        $settings = get_object_vars($this);
        unset($settings['_provider']);

        return $settings;
    }

    /**
     * Renders the current room
     * @return string
     */
    public function render($attr = [])
    {
        //Prepare attributes
        $attr['class'] = 'angular-talk';

        $attr['settings'] = json_encode($this->get_config());

        //Render HTML element
        $html_attrs = [];
        foreach ($attr as $name => $value) {
            $html_attrs[] = $name . '="' . htmlentities($value) . '"';
        }
        return '<div ' . implode(' ', $html_attrs) . '"></div>';
    }
}

class AngularTalk_RoomException extends Exception
{

}