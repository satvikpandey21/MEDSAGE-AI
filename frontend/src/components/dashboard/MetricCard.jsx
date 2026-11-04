import Icon from "../common/Icons";

/**
 * Reusable Metric Summary Card
 * 
 * NOTE FOR BEGINNERS:
 * This component is reusable! Instead of writing 4 separate HTML blocks
 * for each statistic, we define this component once and pass different props
 * (title, value, icon, theme) to it.
 */
export default function MetricCard({
  title,
  value,
  tagText,
  tagType = "blue",
  iconName,
  footerText,
}) {
  return (
    <div className="metric-card">
      <div>
        <div className="metric-top">
          <div className={`metric-icon-box ${tagType}`}>
            <Icon name={iconName} size={22} />
          </div>
          {tagText && (
            <span className={`metric-pill-tag ${tagType}`}>
              {tagText}
            </span>
          )}
        </div>

        <div className="metric-value">{value}</div>
        <div className="metric-title">{title}</div>
      </div>

      {footerText && (
        <div className="metric-footer">
          <Icon name="checkCircle" size={13} color="#10b981" />
          <span>{footerText}</span>
        </div>
      )}
    </div>
  );
}
