<?php

/**
 * A message from a conversation
 */
class AngularTalk_Message
{
    /**
     * Message unique ID
     * @var int
     */
    public $id;

    /**
     * Room or channel where this message belongs
     * @var string
     */
    public $channel;

    /**
     * Message's author
     * @var AngularTalk_Author
     */
    public $author;

    /**
     * Message's content
     * @var string
     */
    public $content;

    /**
     * Unix timestamp of the message date
     * @var int
     */
    public $date;

    /**
     * ID of the message which the current message is a response
     * @var int
     */
    public $replyToID;

    /**
     * Message's title
     * @var string
     */
    public $title;

    /**
     * User rating associated to the message
     * @var int
     */
    public $rating;

    /**
     * Value that indicate if the message has been reviewed by a moderator
     * @var bool
     */
    public $approved;
}
