package com.example.interviewReady.Model;

import java.util.HashSet;
import java.util.Set;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class User {

       @Id
       @GeneratedValue
       private Long id;

       @Column(unique = true)
       private String username;
       private String password;

       @Column(unique = true)
       private String email;
       private Boolean enabled = false;

       @ManyToMany(fetch = FetchType.EAGER, cascade = {CascadeType.MERGE})
       @JoinTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"), inverseJoinColumns = @JoinColumn(name = "role_id"))
       private Set<Role> roles = new HashSet<>();

       public Long getId() {
              return id;
       }

       public void setUsername(String username) {
              this.username = username;
       }

       public void setPassword(String password) {
              this.password = password;
       }

       public void setEmail(String email) {
              this.email = email;
       }

       public void setEnabled(Boolean enabled) {
              this.enabled = enabled;
       }

       public void setRoles(Set<Role> roles) {
              this.roles = roles;
       }

       public String getUsername() {
              return username;
       }

       public String getPassword() {
              return password;
       }

       public String getEmail() {
              return email;
       }

       public Boolean getEnabled() {
              return enabled;
       }

       public Set<Role> getRoles() {
              return roles;
       }

}