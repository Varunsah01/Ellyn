"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Calendar, Mail, Users, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description: string;
  type: "follow_up" | "review" | "sequence";
  dueDate?: Date;
  completed: boolean;
  priority?: "high" | "medium" | "low";
}

interface TaskListProps {
  tasks: Task[];
  onToggle: (taskId: string) => void;
  onViewAll?: () => void;
}

/**
 * Render the TaskList component.
 * @param {TaskListProps} props - Component props.
 * @returns {unknown} JSX output for TaskList.
 * @example
 * <TaskList />
 */
export function TaskList({ tasks, onToggle, onViewAll }: TaskListProps) {
  const getTaskIcon = (type: Task["type"]) => {
    switch (type) {
      case "follow_up":
        return <Mail className="h-4 w-4" />;
      case "review":
        return <Users className="h-4 w-4" />;
      case "sequence":
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority?: Task["priority"]) => {
    switch (priority) {
      case "high":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "medium":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "low":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const incompleteTasks = tasks.filter((t) => !t.completed);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Upcoming Tasks</CardTitle>
          <Badge variant="secondary">{incompleteTasks.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No pending tasks</p>
            </div>
          ) : (
            <>
              {tasks.slice(0, 5).map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border transition-all",
                    task.completed
                      ? "bg-muted/50 opacity-60"
                      : "bg-card hover:bg-muted/50"
                  )}
                >
                  <Checkbox
                    checked={task.completed}
                    onCheckedChange={() => onToggle(task.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-0.5">
                        {getTaskIcon(task.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            task.completed && "line-through text-muted-foreground"
                          )}
                        >
                          {task.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {task.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          {task.dueDate && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {task.dueDate.toLocaleDateString()}
                            </span>
                          )}
                          {task.priority && (
                            <Badge
                              variant="outline"
                              className={cn("text-xs", getPriorityColor(task.priority))}
                            >
                              {task.priority}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {tasks.length > 5 && onViewAll && (
                <Button variant="ghost" onClick={onViewAll} className="w-full">
                  View All Tasks
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
