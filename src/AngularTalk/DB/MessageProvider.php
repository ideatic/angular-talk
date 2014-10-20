<?php

/**
 * Represents a message provider that uses a database as data layer
 */
abstract class AngularTalk_DB_MessageProvider extends AngularTalk_MessageProvider
{
    protected $_table;
    /**
     * @var AngularTalk_DB_Adapter
     */
    protected $_link;

    public function __construct($table, AngularTalk_DB_Adapter $link)
    {
        $this->_table = $table;
        $this->_link = $link;
    }

    /**
     * @inheritdoc
     */
    public function create(AngularTalk_Room $room, AngularTalk_Message $message)
    {
        $dbData = get_object_vars($message);

        $dbData['authorID'] = $message->author->id;
        unset($dbData['author']);

        $success = $this->_link->insert($this->_table, $dbData);

        if ($success) {
            //Set message ID
            $message->id = $this->_link->last_id();
        }

        return $message;
    }

    /**
     * @inheritdoc
     */
    public function get(AngularTalk_Room $room, $sinceID, $dir = 'ASC', $count = 0)
    {
        $channel = $this->_link->escape( $room->channel);
        $since = $this->_link->escape($sinceID);

        if ($dir != 'ASC') {
            $dir = 'DESC';
        }

        $op = $dir == 'ASC' ? '>' : '<';
        $query = "SELECT * FROM {$this->_table} WHERE channel = $channel && id $op $since";

        if ($count > 0) {
            $qdir= $dir == 'ASC' ? 'DESC' : 'ASC';
            $query .= "ORDER BY date $qdir LIMIT $count";
        }

        $data = $this->_link->query($query);

        $messages = array();
        foreach ($data as $row) {
            $message = new AngularTalk_Message();
            foreach ($row as $k => $v) {
                if ($k == 'authorID') {
                    $message->author = $this->authorInfo($v, $room);
                } else {
                    $message->$k = $v;
                }
            }

            $messages[] = $message;
        }

        return $messages;
    }
}