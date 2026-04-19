import styles from './DataTable.module.css';
import EmptyState from './EmptyState';
import SkeletonBlock from './SkeletonBlock';
import { joinClassNames } from '../../utils/formatters';

export default function DataTable({ columns, rows, loading = false, emptyState }) {
  if (loading) {
    return (
      <div className={styles.loadingState}>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className={styles.loadingRow}>
            {columns.map((column) => (
              <SkeletonBlock key={`${index}-${column.key}`} className={styles.loadingCell} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return emptyState ? <EmptyState {...emptyState} /> : null;
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={joinClassNames(
                  column.align === 'right' ? styles.alignRight : '',
                  column.headerClassName,
                )}
                style={column.headerStyle}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const rowId = row.id ?? row._id ?? index;
            return (
              <tr key={rowId}>
                {columns.map((column) => (
                  <td
                    key={`${rowId}-${column.key}`}
                    className={joinClassNames(
                      column.align === 'right' ? styles.alignRight : '',
                      column.cellClassName,
                    )}
                    style={column.cellStyle}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
