<?php

/**
 * Represents a message provider that uses a database as data layer
 */
abstract class AngularTalk_DB_MessageProvider implements AngularTalk_MessageProvider
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
     * @param AngularTalk_Message $message
     *
     * @return array
     */
    protected function _prepare_message(AngularTalk_Message $message)
    {
        $dbData = get_object_vars($message);

        $dbData['authorID'] = $message->author->id;
        unset($dbData['author']);
        return $dbData;
    }

    /**
     * @inheritdoc
     */
    public function create(AngularTalk_Room $room, AngularTalk_Message $message)
    {
        $dbData = $this->_prepare_message($message);

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
        $channel = $this->_link->escape($room->channel);
        $since = $this->_link->escape($sinceID);

        switch ($dir) {
            case 'DESC':
                $op = '<';
                break;

            case 'ID':
                $op = '=';
                break;

            default:
                $dir = 'ASC';
                $op = '>';
                break;

        }

        $query = "SELECT * FROM {$this->_table} WHERE channel = $channel";

        if($sinceID){
            $query.=" && id $op $since";
        }

        if ($count > 0) {
            $qdir = $dir == 'ASC' ? 'ASC' : 'DESC';
            $query .= " ORDER BY date $qdir LIMIT $count";
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

            //Remove unused fields
            if (!$room->allowRating) {
                unset($message->rating);
            }
            if (!$room->allowReplies) {
                unset($message->replyToID);
            }
            if (!$room->onlyApproved) {
                unset($message->approved);
            }

            $messages[] = $message;
        }

        return $dir == 'ID' ? reset($messages) : $messages;
    }


    /**
     * @inheritdoc
     */
    public function update(AngularTalk_Room $room, AngularTalk_Message $message)
    {
        $dbData = $this->_prepare_message($message);
        $set = array();
        foreach ($dbData as $k => $v) {
            $set[] = "`$k` = " . $this->_link->escape($v);
        }

        $id = $this->_link->escape($message->id);
        $set = implode(', ', $set);
        $this->_link->query("UPDATE {$this->_table} SET $set WHERE id = $id");

        return $message;
    }


    /**
     * @inheritdoc
     */
    public function delete(AngularTalk_Room $room, $messageID = null)
    {
        $channel = $this->_link->escape($room->channel);
        if (isset($messageID)) {
            $id = $this->_link->escape($messageID);

            $this->_link->query("DELETE FROM {$this->_table} WHERE channel = $channel && id = $id");
        } else {
            $this->_link->query("DELETE FROM {$this->_table} WHERE channel = $channel");
        }

        return true;
    }
}