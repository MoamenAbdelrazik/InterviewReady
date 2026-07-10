package com.example.interviewReady.DTO;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class BehaviorAnalysisDTO {

    private String summary;
    private String tag;
    private List<AreaOfDevelopment> areasOfDevelopment;
    private List<ActionPlanItem> actionPlan;

    // ─── Inner Classes ───

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AreaOfDevelopment {
        private String topic;
        private String priority;
        private String description;

        public String getTopic() { return topic; }
        public void setTopic(String topic) { this.topic = topic; }

        public String getPriority() { return priority; }
        public void setPriority(String priority) { this.priority = priority; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ActionPlanItem {
        private String priority;
        private String title;
        private String description;

        public String getPriority() { return priority; }
        public void setPriority(String priority) { this.priority = priority; }

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }

    // ─── Getters & Setters ───

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public String getTag() { return tag; }
    public void setTag(String tag) { this.tag = tag; }

    public List<AreaOfDevelopment> getAreasOfDevelopment() { return areasOfDevelopment; }
    public void setAreasOfDevelopment(List<AreaOfDevelopment> areasOfDevelopment) { this.areasOfDevelopment = areasOfDevelopment; }

    public List<ActionPlanItem> getActionPlan() { return actionPlan; }
    public void setActionPlan(List<ActionPlanItem> actionPlan) { this.actionPlan = actionPlan; }
}
