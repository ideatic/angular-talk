<?php

/**
 * Represents a message provider
 */
abstract class AngularTalk_MessageProvider
{
    /**
     * Create a new message into the given room
     *
     * @param AngularTalk_Room    $room    Room where thew new message should be created.
     * @param AngularTalk_Message $message Message content
     *
     * @return AngularTalk_Message Created message
     */
    public abstract function create(AngularTalk_Room $room, AngularTalk_Message $message);

    /**
     * Get the latest messages from the given room
     *
     * @param AngularTalk_Room $room    Room where messages should be retrieved.
     * @param int              $sinceID Last message ID received by the client.
     * @param string           $dir     Direction of the retrieved messages: ASC, from sinceID to newer messages, DESC; from sinceID to older
     * @param int              $count   Number of messages to get, counting backwards from the last ID. 0 to disable limits
     *
     * @return AngularTalk_Message[]
     */
    public abstract function get(AngularTalk_Room $room, $sinceID, $dir = 'ASC', $count = 0);

    /**
     * Gets author info given its ID
     *
     * @param int              $id
     * @param AngularTalk_Room $room
     *
     * @return AngularTalk_Author
     */
    public abstract function authorInfo($id, AngularTalk_Room $room);
}