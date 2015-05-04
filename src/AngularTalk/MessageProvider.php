<?php

/**
 * Represents a message provider
 */
interface AngularTalk_MessageProvider
{
    /**
     * Create a new message into the given room
     *
     * @param AngularTalk_Room    $room    Room where thew new message should be created.
     * @param AngularTalk_Message $message Message content
     *
     * @return AngularTalk_Message Created message
     */
    public function create(AngularTalk_Room $room, AngularTalk_Message $message);

    /**
     * Get the latest messages from the given room
     *
     * @param AngularTalk_Room $room    Room where messages should be retrieved.
     * @param int              $sinceID Last message ID received by the client.
     * @param string           $dir     Direction of the retrieved messages: ASC, from sinceID to newer messages, DESC; from sinceID to older, 'ID' to get the message by the given ID
     * @param int              $count   Number of messages to get, counting backwards from the last ID. 0 to disable limits
     *
     * @return AngularTalk_Message[]|AngularTalk_Message
     */
    public function get(AngularTalk_Room $room, $sinceID, $dir = 'ASC', $count = 0);

    /**
     * Update the given message
     *
     * @param AngularTalk_Room    $room    Room where thew new message should be created.
     * @param AngularTalk_Message $message Editing message
     *
     * @return AngularTalk_Message Edited message
     */
    public function update(AngularTalk_Room $room, AngularTalk_Message $message);

    /**
     * Delete the given message
     *
     * @param AngularTalk_Room $room      Room where thew new message should be created.
     * @param mixed            $messageID Message ID. If not given, deletes all messages of this room
     *
     * @return bool
     */
    public function delete(AngularTalk_Room $room, $messageID = null);

    /**
     * Gets author info given its ID
     *
     * @param int              $id
     * @param AngularTalk_Room $room
     *
     * @return AngularTalk_Author
     */
    public function authorInfo($id, AngularTalk_Room $room);
}