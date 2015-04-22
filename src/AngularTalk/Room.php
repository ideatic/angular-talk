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
     * Enable AJAX request listening
     */
    public function listen($echo = true)
    {
        $response = [
            'status' => 'success'
        ];

        $request = json_decode(file_get_contents('php://input'));

        try {
            $method = strtolower($_REQUEST['method']);
            switch ($method) {
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
                case 'delete':
                    //Load current message
                    $message = $this->_provider->get($this, $request->id, 'ID');

                    if (!$message) {
                        $response['message'] = 'Invalid message ID';
                        throw new RuntimeException;
                    }

                    if (!($this->sender->isModerator || $message->author->id == $this->sender->id)) {
                        $response['message'] = 'Unauthorized';
                        throw new RuntimeException;
                    }

                    if ($method == 'update') {
                        //Set message new values
                        $message->content = $request->content;

                        $response['data'] = $this->_provider->update($this, $message);
                    } else {
                        //Delete message
                        if (!$this->_provider->delete($this, $request->id)) {
                            $response['message'] = 'Delete error';
                            throw new InvalidArgumentException;
                        }
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

        if ($echo) {
            //Output response
            if ($response['status'] != 'success') {
                header("HTTP/1.1 500");
            }

            header('Content-type: application/json');
            echo json_encode($response, JSON_NUMERIC_CHECK);
        }

        return $response;
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
     * @return html
     */
    public function render($attr = array())
    {
        //Prepare attributes
        $attr['class'] = 'angular-talk';

        foreach ($this->get_config() as $name => $value) {
            if (is_bool($value)) {
                if ($value === true) {
                    $attr[$this->_decamelize($name, '-')] = 'true';
                }
            } else {
                $attr[$this->_decamelize($name, '-')] = is_scalar($value) ? $value : json_encode($value);
            }
        }

        //Render HTML element
        $html_attrs = array();
        foreach ($attr as $name => $value) {
            $html_attrs[] = $name . '="' . htmlentities($value) . '"';
        }
        return '<div ' . implode(' ', $html_attrs) . '"></div>';
    }

    private function _decamelize($str, $separator = ' ')
    {
        return strtolower(preg_replace('/([a-z])([A-Z])/', '$1' . $separator . '$2', $str));
    }
}