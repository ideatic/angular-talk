<?php

class DummyProvider implements AngularTalk_MessageProvider
{
    public $replies = false;

    /**
     * Create a new message into the given room
     *
     * @param AngularTalk_Message $message
     */
    public function create(AngularTalk_Room $room, AngularTalk_Message $message)
    {
        $message->id = mt_rand();
        return $message;
    }

    /**
     * Get the latest messages from the given room
     * @return AngularTalk_Message[]
     */
    public function get(AngularTalk_Room $room, $sinceID, $dir = 'ASC', $count = 0)
    {
        $messages = array();
        srand(mt_rand());

        for ($i = 0; $i < ($sinceID == 0 || $dir == 'ID' ? 25 : mt_rand(0, 3)); $i++) {
            $content = array(
                '¡Hola Mundo!',
                'Hello World!',
                'Ciao Mondo!',
                'Bonjour le monde!',
                'Saluton Mondo!',
                'Olá Mundo!',
                'Hej världen!',
                'Hallo Welt!',
                '你好世界！',
                'Hej Verden!'
            );

            $message = new AngularTalk_Message();
            $message->channel = $room->channel;
            $message->id = $sinceID + $i + 1;
            $message->author = $this->authorInfo(mt_rand(1, 4), $room);
            $message->replyToID = $this->replies && $sinceID > 1 && mt_rand(0, 100) < 50 ? mt_rand(1, $sinceID) : 0;

            $message->content = $content[array_rand($content)];
            $message->date = time();
            $messages[] = $message;
        }


        return $dir == 'ID' ? reset($messages) : $messages;
    }

    /**
     * Gets author info given its ID
     *
     * @param int              $id
     * @param AngularTalk_Room $room
     *
     * @return AngularTalk_Author
     */
    public function authorInfo($id, AngularTalk_Room $room)
    {
        $names = array('Javi', 'John', 'Mario', 'Andrea');
        $author = new AngularTalk_Author();
        $author->id = $id;
        $author->name = $names[$id - 1];
        $author->icon = 'static/icons/face' . $id . '.png';

        return $author;
    }

    /**
     * Update the given message
     *
     * @param AngularTalk_Room    $room    Room where thew new message should be created.
     * @param AngularTalk_Message $message Message content
     *
     * @return AngularTalk_Message Edited message
     */
    public function update(AngularTalk_Room $room, AngularTalk_Message $message)
    {
        return $message;
    }

    /**
     * Delete the given message
     *
     * @param AngularTalk_Room    $room    Room where thew new message should be created.
     * @param AngularTalk_Message $message Message content
     *
     * @return bool
     */
    public function delete(AngularTalk_Room $room, $messageID = null)
    {
        return true;
    }
}