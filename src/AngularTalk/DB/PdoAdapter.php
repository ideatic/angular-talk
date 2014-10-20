<?php

class AngularTalk_DB_PdoAdapter extends AngularTalk_DB_Adapter
{

    private $_link;

    public function __construct($dsn, $user = '', $password = '', $options=array())
    {
        if ($dsn instanceof PDO) {
            $this->_link = $dsn;
        } else {
            $this->_link = new PDO($dsn, $user, $password);
        }
    }

    public function query($query)
    {
        $statement = $this->_link->query($query);
        if ($statement === false) {
            $info = $this->_link->errorInfo();
            echo "Error {$info[0]} \"{$info[2]}\" in query \"$query\"";
            return false;
        } else {

            $statement->setFetchMode(PDO::FETCH_ASSOC);
            return $statement->fetchAll();
        }
    }

    public function last_id()
    {
        return $this->_link->lastInsertId();
    }

    public function escape($var)
    {
        return $this->_link->quote($var);
    }

    public function insert($table, $data)
    {
        $columns = implode(',', array_keys($data));
        $values = array();
        foreach ($data as $name => $value) {
            $values[] = ":$name";
        }
        $values = implode(',', $values);

        $query = "INSERT INTO $table ($columns) VALUES ($values)";
        $stmt = $this->_link->prepare($query);

        if ($stmt === false) {
            $info = $this->_link->errorInfo();
            echo "Error {$info[0]} \"{$info[2]}\" in query \"$query\"";
            return false;
        }

        return $stmt->execute($data);
    }

}