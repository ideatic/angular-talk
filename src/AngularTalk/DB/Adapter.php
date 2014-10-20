<?php

/**
 * Adapter between the system's default DB engine and AngularTalk DB requirements
 */
abstract class AngularTalk_DB_Adapter
{

    /**
     * Run a database query and return the data as an associative array
     * @return array
     */
    public abstract function query($query);

    public abstract function last_id();

    public abstract function escape($var);

    public function first_row($query)
    {
        $res = $this->query($query);
        return $res !== false ? $res[0] : false;
    }

    public function first_column($query)
    {
        $row = $this->first_row($query);
        return $row !== false ? (is_array($row) ? reset($row) : $row) : false;
    }

    /**
     * Insert data in the database
     * @return bool
     */
    public function insert($table, $data)
    {
        $columns = implode(',', array_keys($data));
        $values = array();
        foreach ($data as $value) {
            if ($value === null) {
                $values[] = 'NULL';
            } elseif (is_numeric($value)) {
                $values[] = $value;
            } else {
                $values[] = $this->escape($value);
            }
        }
        $values = implode(',', $values);

        return $this->query("INSERT INTO $table ($columns) VALUES ($values)");
    }

}