package com.example.interviewReady.Model;

import java.math.BigDecimal;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "subscription")
public class Subscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String planName; // Free, Basic, Premium

    @Column(nullable = false)
    private BigDecimal price;

    @Column(nullable = false)
    private Integer credits; // base quota (e.g. 2 for Free)

    public Subscription() {}

    public Subscription(String planName, BigDecimal price, Integer credits) {
        this.planName = planName;
        this.price = price;
        this.credits = credits;
    }

    public Long getId() { return id; }

    public String getPlanName() { return planName; }
    public void setPlanName(String planName) { this.planName = planName; }

    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }

    public Integer getCredits() { return credits; }
    public void setCredits(Integer credits) { this.credits = credits; }
}
