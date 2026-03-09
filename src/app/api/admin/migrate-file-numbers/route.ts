import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), '1300.xlsx');

        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'Excel file not found at ' + filePath }, { status: 404 });
        }

        // Create Admin Client to bypass RLS
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

        const fileBuffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (rows.length < 2) {
            return NextResponse.json({ error: 'Excel file is empty' }, { status: 400 });
        }

        const headers = (rows[0] as string[]).map(h => String(h || '').trim().toLowerCase());

        // --- HEADER DETECTION ---
        // Priority for ID: contains "هوية" or "هويه".
        let idIdx = headers.findIndex(h => h.includes('هوية') || h.includes('هويه'));
        if (idIdx === -1) idIdx = headers.findIndex(h => h === 'id' || h === 'identiy');

        // Priority for File Number: contains "ملف" OR Is the "م" (serial) column
        let fileNumIdx = headers.findIndex(h => h.includes('ملف') || h === 'file_number' || h === 'file');

        // If not found, look for "م" (common for serial/file # in Arabic exports)
        if (fileNumIdx === -1) {
            fileNumIdx = headers.findIndex(h => h === 'م' || h === 'الرقم' || h === 'sn');
        }

        // If STILL not found, look for ANY column with "رقم" that is NOT "هوية" AND NOT "جوال"
        if (fileNumIdx === -1) {
            fileNumIdx = headers.findIndex((h, idx) =>
                h.includes('رقم') &&
                idx !== idIdx &&
                !h.includes('جوال') &&
                !h.includes('هاتف')
            );
        }

        if (idIdx === -1 || fileNumIdx === -1) {
            return NextResponse.json({
                error: 'Required columns not found',
                headersFound: headers,
                detectedIndices: { idIdx, fileNumIdx, idName: headers[idIdx], fileName: headers[fileNumIdx] }
            }, { status: 400 });
        }

        const dataRows = rows.slice(1);
        const updates = dataRows
            .filter(row => row[idIdx] && row[fileNumIdx])
            .map(row => ({
                identity_number: String(row[idIdx]).trim(),
                file_number: String(row[fileNumIdx]).trim()
            }));

        let successCount = 0;
        let failCount = 0;
        let matchedCount = 0;
        const debugInfo: any[] = [];
        const errors: any[] = [];

        // Check total count in DB for diagnostic
        const { count: totalInDB } = await adminSupabase.from('beneficiaries').select('*', { count: 'exact', head: true });

        // Process in chunks of 50
        const chunkSize = 50;
        for (let i = 0; i < updates.length; i += chunkSize) {
            const chunk = updates.slice(i, i + chunkSize);
            await Promise.all(chunk.map(async (update, idx) => {
                const { data, error } = await adminSupabase
                    .from('beneficiaries')
                    .update({ file_number: update.file_number })
                    .eq('identity_number', update.identity_number)
                    .select('id, identity_number');

                if (error) {
                    failCount++;
                    errors.push({ id: update.identity_number, error: error.message });
                } else {
                    successCount++;
                    if (data && data.length > 0) {
                        matchedCount += data.length;
                    } else {
                        // Diagnostic: Only for first few misses
                        if (debugInfo.length < 5) {
                            const { data: check } = await adminSupabase
                                .from('beneficiaries')
                                .select('identity_number')
                                .ilike('identity_number', `%${update.identity_number}%`)
                                .limit(1);

                            debugInfo.push({
                                excel_id: update.identity_number,
                                excel_file_num: update.file_number,
                                wasMatched: false,
                                db_fuzzy_suggestion: check && check.length > 0 ? check[0].identity_number : 'Not found'
                            });
                        }
                    }
                }
            }));
        }

        return NextResponse.json({
            message: 'Migration completed with ADMIN access',
            totalInDB,
            totalRowsInExcel: dataRows.length,
            validUpdatesFound: updates.length,
            detectedHeaders: {
                id: headers[idIdx],
                file_number: headers[fileNumIdx]
            },
            successfullyUpdatedRequests: successCount,
            actualMatchedRows: matchedCount,
            debugSamples: debugInfo,
            failedUpdates: failCount,
            errors: errors.slice(0, 10)
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
