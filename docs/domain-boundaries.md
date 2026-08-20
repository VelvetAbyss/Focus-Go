# Domain Boundaries

Focus&go is task-first. The product core is not a collection of parallel modules; it is a workflow where Notes hold context, Projects organize goals, and Tasks drive execution.

## Core Domain: Task Execution

Task owns the rules for work getting done:

- Task status, priority, completion, Today state, blocking, dependencies, subtasks, date ranges, due/overdue rules, quick add parsing, filtering, and task analytics.
- Task application services are the only place that should create tasks from UI flows, project flows, note flows, or quick add input.
- UI components may render task state, but they should not redefine task lifecycle rules.

## Supporting Domains

Project Planning organizes tasks around goals:

- Project owns title, goal, status, priority, timeline, people, risks, linked notes, project color, and project-level summaries.
- Project may summarize project tasks, but it must reuse Task domain rules for done, blocked, overdue, and next-action ranking.
- Project must create project-scoped tasks through Task application services.

Note Context provides source material and execution context:

- Note owns content, editor state, tags, backlinks, trash, import/export, and appearance.
- Project note linkage keeps the existing `project:<projectId>` tag/link mechanism.
- Note must not write task storage directly. Future Note-to-Task extraction should call a Task application service such as `createTaskFromNote`.

## Infrastructure

Sync, Auth, Payments, Storage, I18n, Theme, and deployment are infrastructure. They can persist, protect, translate, or present domain data, but they should not decide task lifecycle behavior.

## Boundary Rules

- `Task` rules are pure functions where possible.
- `Project` summaries can depend on Task domain functions.
- `Note` can provide context for a Task, but Task creation remains a Task application concern.
- Repositories remain persistence boundaries for now; this phase does not change schemas or migrate data.
- New feature work should prefer `features/<domain>/domain` for pure rules and `features/<domain>/application` for use cases before adding more logic to pages or components.
