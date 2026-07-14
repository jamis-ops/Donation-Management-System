export default function PageHeader({ title, description, actions }) {
  return (
    <div className="admin-page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="admin-page-header__actions">{actions}</div>}
    </div>
  )
}
