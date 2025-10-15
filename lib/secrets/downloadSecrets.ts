export const downloadAsCSV = (
  secrets: Array<{
    key: string;
    value?: string | null | undefined;
    note?: string | null | undefined;
  }>,
) => {
  const csvRows = [
    ['Key', 'Value', 'Note'].join(','),
    ...secrets.map((secret) => {
      const key = `"${(secret.key || '').replace(/"/g, '""')}"`;
      const value = `"${(secret.value || '').replace(/"/g, '""')}"`;
      const note = `"${(secret.note || '').replace(/"/g, '""')}"`;
      return [key, value, note].join(',');
    }),
  ].join('\n');

  const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `secrets_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const downloadAsEnv = (
  secrets: Array<{
    key: string;
    value?: string | null | undefined;
    note?: string | null | undefined;
  }>,
) => {
  const envContent = secrets
    .map((secret) => {
      const lines = [];
      if (secret.note) lines.push(`# ${secret.note}`);
      const value =
        (secret.value || '').includes('\n') || (secret.value || '').includes(' ')
          ? `"${secret.value}"`
          : secret.value || '';
      lines.push(`${secret.key}=${value}`);
      return lines.join('\n');
    })
    .join('\n\n');

  const blob = new Blob([envContent], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `.env.${new Date().toISOString().split('T')[0]}`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
