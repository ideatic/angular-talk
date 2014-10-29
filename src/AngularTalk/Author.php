<?php

/**
 * A message's author
 */
class AngularTalk_Author
{
    public $id;
    public $name;
    public $icon;
    public $email;
    public $url;
    public $isModerator = false;

    public function __construct($id = 0, $name = '', $icon = '')
    {
        $this->id = $id;
        $this->name = $name;
        $this->icon = $icon;
    }
}