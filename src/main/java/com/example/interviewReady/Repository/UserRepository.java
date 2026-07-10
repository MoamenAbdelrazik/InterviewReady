package com.example.interviewReady.Repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.interviewReady.Model.User;

public interface UserRepository extends JpaRepository<User, Long> {
    User findByUsername(String username);
    User findByEmail(String email);
}