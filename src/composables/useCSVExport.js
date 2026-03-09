const CSV_BYTES_PER_ROW = 200;        // rough estimate for file size warning
const CSV_ROW_WARN_THRESHOLD = 10_000; // warn if export exceeds this many rows
const CSV_SIZE_WARN_MB = 2;            // warn if estimated size exceeds this (MB)

export function useCSVExport(dataTable, filteredRows, processedCustomers, formatDate) {
    const escapeCSVField = (field) => {
        if (field == null) return '';
        const str = Array.isArray(field) ? field.join('; ') : String(field);
        return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
    };

    // Calculate estimated file size
    const estimateFileSizeMB = (rowCount) => {
        const estimatedBytes = rowCount * CSV_BYTES_PER_ROW;
        return (estimatedBytes / (1024 * 1024)).toFixed(2);
    };

    const exportToCSV = () => {
        if (!dataTable.value) {
            alert('Table not ready');
            return;
        }

        const dataToExport = filteredRows.value?.length > 0 ? filteredRows.value : processedCustomers.value || [];

        if (!dataToExport.length) {
            alert('No data to export');
            return;
        }

        const rowCount = dataToExport.length;
        const estimatedSizeMB = estimateFileSizeMB(rowCount);

        // Warn if exporting large datasets (>10k rows or >2MB)
        if (rowCount > CSV_ROW_WARN_THRESHOLD || parseFloat(estimatedSizeMB) > CSV_SIZE_WARN_MB) {
            const warned = confirm(
                `⚠️ Large export detected!\n\n` +
                `Rows: ${rowCount.toLocaleString()}\n` +
                `Estimated size: ~${estimatedSizeMB} MB\n\n` +
                `This may take a moment. Continue?`
            );
            if (!warned) return;
        }

        const headers = ['Date', 'Topic', 'Ticket ID', 'Brand', 'VIP Level', 'Customer Email', 'Agent Email', 'CSAT Score', 'Chat Tags', 'Chat Transcript', 'Email Transcript', 'Sentiment', 'Summary'];

        const rows = dataToExport.map((customer) => [
            formatDate(customer.timestamp),
            customer.topic,
            customer.ticketid,
            customer.brand,
            customer.vip_level,
            customer.customer_email,
            customer.agent_email,
            customer.csat_score,
            customer._chatTagsString,
            customer.chat_transcript,
            customer.email_transcript,
            customer.sentiment,
            customer.summary
        ]);

        const csvLines = [headers.map(escapeCSVField).join(','), ...rows.map((row) => row.map(escapeCSVField).join(','))];

        const csvString = csvLines.join('\r\n');
        const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
        const blob = new Blob([bom, csvString], { type: 'text/csv;charset=utf-8;' });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `customers-${new Date().toLocaleDateString('en-CA')}.csv`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return { exportToCSV };
}
