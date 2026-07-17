import { tasks } from '../../data/adminMockData'
import PageHeader from '../../components/admin/shared/PageHeader'
import StatusBadge from '../../components/admin/shared/StatusBadge'
import { User, Calendar } from 'lucide-react'

const columns = [
  { id: 'todo', label: 'To Do', items: tasks.todo },
  { id: 'inProgress', label: 'In Progress', items: tasks.inProgress },
  { id: 'review', label: 'In Review', items: tasks.review },
  { id: 'done', label: 'Done', items: tasks.done },
]

function TaskCard({ task }) {
  return (
    <div className="kanban-card">
      <div className="kanban-card__header">
        <span className="kanban-card__id">{task.id}</span>
        <StatusBadge status={task.priority} />
      </div>
      <h4>{task.title}</h4>
      <div className="kanban-card__meta">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <User size={12} />
          {task.assignee}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <Calendar size={12} />
          {task.due}
        </span>
      </div>
      <span className="kanban-card__module">{task.module}</span>
    </div>
  )
}

export default function TasksPage() {
  return (
    <>
      <PageHeader
        title="Task Management"
        description="Kanban board for assigning and tracking operational tasks."
        actions={
          <button type="button" className="btn btn--primary">
            + New Task
          </button>
        }
      />

      <div className="kanban-board">
        {columns.map((col) => (
          <div key={col.id} className="kanban-column">
            <div className="kanban-column__header">
              <h3>{col.label}</h3>
              <span className="kanban-column__count">{col.items.length}</span>
            </div>
            <div className="kanban-column__cards">
              {col.items.length === 0 ? (
                <p
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--admin-text-subtle)',
                    textAlign: 'center',
                    padding: '1rem 0',
                    margin: 0,
                  }}
                >
                  No tasks
                </p>
              ) : (
                col.items.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
