const CSV_BYTES_PER_ROW = 200; // rough estimate for file size warning
const CSV_ROW_WARN_THRESHOLD = 10_000; // warn if export exceeds this many rows
const CSV_SIZE_WARN_MB = 2; // warn if estimated size exceeds this (MB)
const CSV_BATCH_SIZE = 2_000; // rows processed per batch to avoid main-thread blocking

export function useCSVExport(dataTable, filteredRows, formatDate) {
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

    /**
     * Build a CSV row string from a ticket object (avoids intermediate array allocation).
     */
    const ticketToCSVRow = (ticket) => {
        return [
            formatDate(ticket.timestamp),
            ticket.topic,
            ticket.ticketid,
            ticket.brand,
            ticket.vip_level,
            ticket.customer_email,
            ticket.agent_email,
            ticket.csat_score,
            ticket._chatTagsString,
            ticket.chat_transcript,
            ticket.email_transcript,
            ticket.sentiment,
            ticket.sentiment_reason,
            ticket.summary
        ]
            .map(escapeCSVField)
            .join(',');
    };

    /**
     * Yield to the main thread between batches to prevent UI blocking.
     */
    const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

    /**
     * Build CSV string in batches — yields to main thread every CSV_BATCH_SIZE rows
     * to prevent long-task blocking on large exports (10k+ rows).
     */
    const buildCSVBatched = async (data, headerLine) => {
        const chunks = [headerLine];

        for (let i = 0; i < data.length; i += CSV_BATCH_SIZE) {
            const end = Math.min(i + CSV_BATCH_SIZE, data.length);
            for (let j = i; j < end; j++) {
                chunks.push(ticketToCSVRow(data[j]));
            }
            // Yield between batches to keep UI responsive
            if (end < data.length) {
                await yieldToMain();
            }
        }

        return chunks.join('\r\n');
    };

    const exportToCSV = async () => {
        if (!dataTable.value) {
            alert('Table not ready');
            return;
        }

        const dataToExport = filteredRows.value || [];

        if (!dataToExport.length) {
            alert('No data to export');
            return;
        }

        const rowCount = dataToExport.length;
        const estimatedSizeMB = estimateFileSizeMB(rowCount);

        // Warn if exporting large datasets (>10k rows or >2MB)
        if (rowCount > CSV_ROW_WARN_THRESHOLD || parseFloat(estimatedSizeMB) > CSV_SIZE_WARN_MB) {
            const warned = confirm(`⚠️ Large export detected!\n\n` + `Rows: ${rowCount.toLocaleString()}\n` + `Estimated size: ~${estimatedSizeMB} MB\n\n` + `This may take a moment. Continue?`);
            if (!warned) return;
        }

        const headers = ['Date', 'Topic', 'Ticket ID', 'Brand', 'VIP Level', 'Customer Email', 'Agent Email', 'CSAT Score', 'Chat Tags', 'Chat Transcript', 'Email Transcript', 'Sentiment', 'Sentiment Reason', 'Summary'];
        const headerLine = headers.map(escapeCSVField).join(',');

        const csvString = await buildCSVBatched(dataToExport, headerLine);
        const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
        const blob = new Blob([bom, csvString], { type: 'text/csv;charset=utf-8;' });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tickets-${new Date().toLocaleDateString('en-CA')}.csv`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return { exportToCSV };
}
