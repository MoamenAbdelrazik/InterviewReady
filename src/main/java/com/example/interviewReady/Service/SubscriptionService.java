package com.example.interviewReady.Service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.example.interviewReady.Model.Subscription;
import com.example.interviewReady.Repository.SubscriptionRepository;

@Service
public class SubscriptionService {

    private final SubscriptionRepository subscriptionRepository;

    public SubscriptionService(SubscriptionRepository subscriptionRepository) {
        this.subscriptionRepository = subscriptionRepository;
    }

    public Subscription getFreePlan() {
        return subscriptionRepository.findByPlanName("Free")
                .orElseThrow(() -> new RuntimeException("Free plan not found — run seed data"));
    }

    public Subscription getByPlanName(String planName) {
        return subscriptionRepository.findByPlanName(planName)
                .orElseThrow(() -> new RuntimeException("Plan not found: " + planName));
    }

    public List<Subscription> getAllPlans() {
        return subscriptionRepository.findAll();
    }

    public Subscription createPlan(Subscription subscription) {
        return subscriptionRepository.save(subscription);
    }
}
