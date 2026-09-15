export const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export function initials(name) { return name.split(' ').map(n=>n[0]).slice(0,2).join(''); }
export const icons = {
 dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 projects:'<path d="M3 7h7l2-3h8a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
 expenses:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>',
 receipts:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 14h4"/>',
 remaining:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 subscriptions:'<path d="M4 10a8 8 0 0 1 14-5l2 2M20 3v4h-4M20 14a8 8 0 0 1-14 5l-2-2M4 21v-4h4"/>',
 partners:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 4v2"/>',
 notifications:'<path d="M5 16h14l-2-3V9a5 5 0 0 0-10 0v4zM10 20h4"/>',
 arrow:'<path d="M5 12h14M14 7l5 5-5 5"/>', plus:'<path d="M12 5v14M5 12h14"/>',
 search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
 logout:'<path d="M9 4H4v16h5M10 12h11M17 8l4 4-4 4"/>',
 check:'<path d="m5 12 4 4L19 6"/>', close:'<path d="m6 6 12 12M18 6 6 18"/>',
 refresh:'<path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6"/>',
 download:'<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>'
};
export const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name]||icons.projects)+'</svg>';
export const badge = (label,tone='blue') => '<span class="badge '+tone+'"><i></i>'+esc(label)+'</span>';
export function table(headers, rows, empty='No records yet.') {
 return '<div class="table-scroll"><table><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+ (rows.length?rows.join(''):'<tr><td colspan="'+headers.length+'" class="no-records">'+esc(empty)+'</td></tr>')+'</tbody></table></div>';
}
