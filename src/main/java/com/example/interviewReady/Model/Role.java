package com.example.interviewReady.Model;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;

@Entity
public class Role {

    @Id
    @GeneratedValue
    private Long id;

    private String name; // ROLE_ADMIN, ROLE_USER

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}