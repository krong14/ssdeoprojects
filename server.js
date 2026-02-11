const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const XLSX = require('xlsx');
const multer = require('multer');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const engineersFilePath = path.join(__dirname, 'engineers.json');
const powFilePath = path.join(__dirname, 'pow-data.json');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// Wasabi (S3-compatible) storage config
const WASABI_ACCESS_KEY_ID = process.env.WASABI_ACCESS_KEY_ID || '';
const WASABI_SECRET_ACCESS_KEY = process.env.WASABI_SECRET_ACCESS_KEY || '';
const WASABI_BUCKET = process.env.WASABI_BUCKET || '';
const WASABI_REGION = process.env.WASABI_REGION || 'us-east-1';
const WASABI_ENDPOINT = process.env.WASABI_ENDPOINT || '';
const WASABI_PUBLIC_URL = process.env.WASABI_PUBLIC_URL || '';
const WASABI_SIGNED_URL_EXPIRES = Number(process.env.WASABI_SIGNED_URL_EXPIRES || 3600);
const UPLOAD_MAX_MB = Number(process.env.UPLOAD_MAX_MB || 100);

const hasWasabi =
    Boolean(WASABI_ACCESS_KEY_ID && WASABI_SECRET_ACCESS_KEY && WASABI_BUCKET && WASABI_ENDPOINT);

const s3 = hasWasabi
    ? new S3Client({
        region: WASABI_REGION,
        endpoint: WASABI_ENDPOINT,
        credentials: {
            accessKeyId: WASABI_ACCESS_KEY_ID,
            secretAccessKey: WASABI_SECRET_ACCESS_KEY
        },
        forcePathStyle: true
    })
    : null;

const uploadDir = path.join(os.tmpdir(), 'dpwh-uploads');
try {
    fs.mkdirSync(uploadDir, { recursive: true });
} catch (err) {
    console.warn('Failed to create upload dir:', err.message);
}
const upload = multer({
    dest: uploadDir,
    limits: {
        fileSize: Math.max(1, UPLOAD_MAX_MB) * 1024 * 1024
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Path to Excel file
const excelFilePath = process.env.EXCEL_FILE_PATH
    ? path.resolve(process.env.EXCEL_FILE_PATH)
    : path.join(__dirname, 'projects.xlsx');

const HEADERS = [
    'CONTRACT ID',
    'CONTRACT NAME/LOCATION',
    'LOCATION',
    'TYPE OF PROJECT',
    'APPROPRIATION',
    'APPROVED BUDGET COST (ABC)',
    'CONTRACT AMOUNT',
    'REVISED CONTRACT AMOUNT',
    'CONTRACTOR',
    'CONTRACT DURATION',
    'START DATE',
    'EXPIRATION DATE',
    'REVISED EXPIRATION DATE',
    'REMAINING DAYS',
    'STATUS OF PROJECT',
    'INPUT 1ST BILLING',
    'SWA (%) 1ST BILLING',
    '2ND BILLING',
    'QUALITY CONTROL PROGRAM (QCA-01)',
    'CCQA (QCA-02, QCA-03) - WEEKLY',
    'CCQA (QCA-02, QCA-03) - MONTHLY',
    'LATEST DATE UPDATED',
    'STATUS OF LABORATORY TESTS (QCA-04)',
    'STATUS OF TEST RESULTS (QCA-05)',
    'SUMMARY OF FIELD TEST RESULTS (QCA-06)',
    'MATERIALS INSPECTION REPORT (QCA-07)',
    'REPORT ON CONCRETE WORKS (QCA-08)',
    'SITE INSPECTION',
    'DESIGN HUX',
    'TRIAL MIX',
    'GEOTAGGED PHOTOS (INPUT LATEST DATES)',
    'TRIAL MIX',
    'GEOTAGGED TEST REPORTS (INPUT LATEST)',
    'SOURCING PERMIT (INPUT LATEST)',
    'LOGBOOK (INPUT LATEST DATE)',
    'JOB CONTROL FORMS (INPUT LATEST)',
    'ORIGINAL PLAN',
    'AS STAKED PLAN',
    'AS-BUILT PLAN',
    'PROGRAM OF WORKS',
    'VARIATIONS (IF APPLICABLE) V.O.1',
    'VARIATIONS (IF APPLICABLE) V.O.2',
    'VARIATIONS (IF APPLICABLE) V.O.3',
    'VARIATIONS (IF APPLICABLE) V.O.4',
    'TIME SUSPENSION REPORT',
    'TIME EXTENSION REPORT',
    'PROJECT ENGINEER',
    'MATERIALS ENGINEER',
    'PROJECT INSPECTOR',
    'QUALITY ASSURANCE IN-CHARGE',
    'RESIDENT ENGINEER',
    'CONTRACTORS MATERIALS ENGINEER'
];

const SECTION_DOCS = {
    contracts: [
        'Project Designation Order',
        "Contractor's Materials Engineer",
        'Contract',
        'Notice to Proceed'
    ],
    planning: [
        'Original Plan',
        'As-Staked Plan',
        'As-Built Plan',
        'Original Program of Works',
        'Revised Program of Works',
        'Bill of Quantities',
        'Detailed Unit Price Analysis'
    ],
    construction: [
        'Project Billings',
        'Statement of Work Accomplished',
        'Engineers Certificate',
        'Pouring Permits',
        'Contract Time Suspension Report',
        'Contract Time Extension Report',
        'Contract Weather Report',
        'Punchlist'
    ],
    qa: [
        'Certificate of Quality Control Assurance (CQCA MONTHLY) (QCA-02)',
        'Certificate of Quality Control Assurance (CQCA WEEKLY) (QCA-03)',
        'Status of Field and Laboratory Test (QCA-04)',
        'Status of Test (QCA-05)',
        'Summary of Field Test (QCA-06)',
        'Materials Inspection Report (QCA-07)',
        'Report on Concrete Works (QCA-08)',
        'Site Instructions (Letter to Construction)',
        'Test Reports and Worksheets (Per Billing)'
    ],
    contractor: [
        'Bar Chart',
        'Back-Up Computation',
        'Design Mix and Trial Mix Results',
        'Accreditation of Batching Plant',
        'Job Control Forms',
        'Quality Control Program (QCA-01)'
    ]
};

function safeKeyPart(value) {
    return encodeURIComponent(String(value || '').trim());
}

function decodeKeyPart(value) {
    try {
        return decodeURIComponent(value);
    } catch (err) {
        return value;
    }
}

function sanitizeFilename(name) {
    return String(name || 'file')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 180);
}

function buildDocumentKey(contractId, section, docName, filename) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = sanitizeFilename(filename);
    return `documents/${safeKeyPart(contractId)}/${safeKeyPart(section)}/${safeKeyPart(docName)}/${stamp}-${safeName}`;
}

function buildGalleryKey(contractId, filename) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = sanitizeFilename(filename);
    return `gallery/${safeKeyPart(contractId)}/${stamp}-${safeName}`;
}

async function listAllObjects(prefix) {
    if (!s3) return [];
    const items = [];
    let token = undefined;
    do {
        const response = await s3.send(new ListObjectsV2Command({
            Bucket: WASABI_BUCKET,
            Prefix: prefix,
            ContinuationToken: token
        }));
        items.push(...(response.Contents || []));
        token = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (token);
    return items;
}

async function getObjectUrl(key) {
    if (!s3 || !key) return '';
    if (WASABI_PUBLIC_URL) {
        const base = WASABI_PUBLIC_URL.replace(/\/$/, '');
        return `${base}/${key}`;
    }
    const command = new GetObjectCommand({ Bucket: WASABI_BUCKET, Key: key });
    return getSignedUrl(s3, command, { expiresIn: WASABI_SIGNED_URL_EXPIRES });
}

function requireWasabi(req, res, next) {
    if (!s3) {
        return res.status(503).json({
            success: false,
            error: 'Wasabi storage is not configured.'
        });
    }
    next();
}

// ----------------------------------------------------------------------------------------------
// Engineers directory (simple JSON persistence)
// ----------------------------------------------------------------------------------------------
function normalizeEngineer(entry) {
    return {
        name: String(entry?.name || '').trim(),
        role: String(entry?.role || '').trim(),
        phone: String(entry?.phone || '').trim(),
        facebook: String(entry?.facebook || '').trim(),
        accreditation: String(entry?.accreditation || '').trim()
    };
}

function readEngineers() {
    try {
        const raw = fs.readFileSync(engineersFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(normalizeEngineer).filter(item => item.name);
    } catch (err) {
        return [];
    }
}

function writeEngineers(list) {
    const normalized = (Array.isArray(list) ? list : []).map(normalizeEngineer).filter(item => item.name);
    fs.writeFileSync(engineersFilePath, JSON.stringify(normalized, null, 2));
    return normalized;
}

function findEngineerIndex(list, name, role) {
    const targetName = String(name || '').trim().toLowerCase();
    const targetRole = String(role || '').trim().toLowerCase();
    return list.findIndex(e =>
        String(e.name || '').trim().toLowerCase() === targetName &&
        String(e.role || '').trim().toLowerCase() === targetRole
    );
}

// ----------------------------------------------------------------------------------------------
// Program of Works persistence (JSON file)
// ----------------------------------------------------------------------------------------------
function normalizeContractId(value) {
    return String(value || '').trim().toUpperCase();
}

function normalizePowItem(item) {
    if (typeof item === 'string') {
        return {
            itemNo: String(item || '').trim(),
            description: '',
            quantity: '',
            unit: ''
        };
    }
    return {
        itemNo: String(item?.itemNo || '').trim(),
        description: String(item?.description || '').trim(),
        quantity: String(item?.quantity || '').trim(),
        unit: String(item?.unit || '').trim()
    };
}

function normalizePowItems(value) {
    if (!Array.isArray(value)) return [];
    return value
        .map(normalizePowItem)
        .filter(item => item.itemNo || item.description || item.quantity || item.unit);
}

function normalizeVariationOrders(value) {
    if (!Array.isArray(value)) return [];
    if (value.length && !Array.isArray(value[0])) {
        const one = normalizePowItems(value);
        return one.length ? [one] : [];
    }
    return value
        .map(list => normalizePowItems(list))
        .filter(list => list.length);
}

function readPowStore() {
    try {
        if (!fs.existsSync(powFilePath)) return {};
        const raw = fs.readFileSync(powFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
        return {};
    }
}

function writePowStore(store) {
    const safeStore = store && typeof store === 'object' ? store : {};
    fs.writeFileSync(powFilePath, JSON.stringify(safeStore, null, 2));
    return safeStore;
}

function getPowRecord(contractId) {
    const key = normalizeContractId(contractId);
    if (!key) return { programWorks: [], variationOrders: [], updatedAt: '' };
    const store = readPowStore();
    const value = store[key] || {};
    return {
        programWorks: normalizePowItems(value.programWorks),
        variationOrders: normalizeVariationOrders(value.variationOrders),
        updatedAt: String(value.updatedAt || '')
    };
}

function setPowRecord(contractId, payload = {}) {
    const key = normalizeContractId(contractId);
    if (!key) return { key: '', record: { programWorks: [], variationOrders: [], updatedAt: '' } };
    const store = readPowStore();
    const next = {
        programWorks: normalizePowItems(payload.programWorks),
        variationOrders: normalizeVariationOrders(payload.variationOrders),
        updatedAt: new Date().toISOString()
    };
    store[key] = next;
    writePowStore(store);
    return { key, record: next };
}

function deletePowRecord(contractId) {
    const key = normalizeContractId(contractId);
    if (!key) return false;
    const store = readPowStore();
    if (!store[key]) return false;
    delete store[key];
    writePowStore(store);
    return true;
}

app.get('/api/pow/:contractId', (req, res) => {
    const contractId = normalizeContractId(req.params.contractId || '');
    if (!contractId) {
        return res.status(400).json({ success: false, error: 'Missing contractId.' });
    }
    const record = getPowRecord(contractId);
    res.json({
        success: true,
        contractId,
        programWorks: record.programWorks,
        variationOrders: record.variationOrders,
        updatedAt: record.updatedAt
    });
});

app.put('/api/pow/:contractId', (req, res) => {
    const contractId = normalizeContractId(req.params.contractId || '');
    if (!contractId) {
        return res.status(400).json({ success: false, error: 'Missing contractId.' });
    }
    const { record } = setPowRecord(contractId, req.body || {});
    res.json({
        success: true,
        contractId,
        programWorks: record.programWorks,
        variationOrders: record.variationOrders,
        updatedAt: record.updatedAt
    });
});

app.get('/api/engineers', (req, res) => {
    const engineers = readEngineers();
    res.json({ success: true, engineers });
});

app.post('/api/engineers', (req, res) => {
    const payload = normalizeEngineer(req.body || {});
    if (!payload.name) {
        return res.status(400).json({ success: false, error: 'Engineer name is required.' });
    }
    const list = readEngineers();
    const idx = findEngineerIndex(list, payload.name, payload.role);
    if (idx >= 0) {
        list[idx] = { ...list[idx], ...payload, name: list[idx].name };
    } else {
        list.push(payload);
    }
    const saved = writeEngineers(list);
    res.json({ success: true, engineers: saved, total: saved.length });
});

app.delete('/api/engineers/:name', (req, res) => {
    const name = String(req.params.name || '').trim();
    const role = String(req.query.role || '').trim();
    if (!name) {
        return res.status(400).json({ success: false, error: 'Engineer name is required.' });
    }
    const list = readEngineers();
    const filtered = role
        ? list.filter(item =>
            !(String(item.name || '').trim().toLowerCase() === name.toLowerCase() &&
              String(item.role || '').trim().toLowerCase() === role.toLowerCase()))
        : list.filter(item => String(item.name || '').trim().toLowerCase() !== name.toLowerCase());

    if (filtered.length === list.length) {
        return res.status(404).json({ success: false, error: 'Engineer not found.' });
    }
    const saved = writeEngineers(filtered);
    res.json({ success: true, engineers: saved, total: saved.length });
});

// Initialize Excel file if it doesn't exist
function initializeExcel() {
    if (!fs.existsSync(excelFilePath)) {
        const workbook = XLSX.utils.book_new();
        
        // Create worksheet with empty rows 1-2, headers in row 3
        const worksheet = XLSX.utils.aoa_to_sheet([
            [], // Row 1 - empty (will be merged/formatted)
            [], // Row 2 - empty (will be merged/formatted)
            HEADERS // Row 3 - actual headers
        ]);
        
        // Set column widths
        worksheet['!cols'] = HEADERS.map(() => ({ wch: 15 }));
        
        // Apply orange background to row 1 (A1:AZ1) and row 2 (A2:AZ2)
        const orangeFill = { fgColor: { rgb: 'FFA500' }, patternType: 'solid' };
        const orangeFont = { color: { rgb: 'FFFFFF' }, bold: true };
        
        // Format row 1 and 2 with orange background
        for (let col = 0; col < HEADERS.length; col++) {
            const cellAddress1 = XLSX.utils.encode_cell({ r: 0, c: col });
            const cellAddress2 = XLSX.utils.encode_cell({ r: 1, c: col });
            const cellAddress3 = XLSX.utils.encode_cell({ r: 2, c: col });
            
            // Row 1
            if (!worksheet[cellAddress1]) worksheet[cellAddress1] = {};
            worksheet[cellAddress1].fill = orangeFill;
            worksheet[cellAddress1].font = orangeFont;
            worksheet[cellAddress1].alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
            
            // Row 2
            if (!worksheet[cellAddress2]) worksheet[cellAddress2] = {};
            worksheet[cellAddress2].fill = orangeFill;
            worksheet[cellAddress2].font = orangeFont;
            worksheet[cellAddress2].alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
            
            // Row 3 - Header formatting
            if (!worksheet[cellAddress3]) worksheet[cellAddress3] = {};
            worksheet[cellAddress3].fill = { fgColor: { rgb: 'E8F4F8' }, patternType: 'solid' };
            worksheet[cellAddress3].font = { bold: true, color: { rgb: '000000' } };
            worksheet[cellAddress3].alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
        }
        
        // Set row heights
        worksheet['!rows'] = [
            { hpx: 25 }, // Row 1
            { hpx: 25 }, // Row 2
            { hpx: 30 }  // Row 3
        ];
        
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');
        XLSX.writeFile(workbook, excelFilePath);
        console.log('Excel file created successfully with DPWH formatting');
    }
}

// Save project to Excel
app.post('/api/save-project', (req, res) => {
    try {
        const projectData = req.body;

        // Read existing workbook
        const workbook = XLSX.readFile(excelFilePath);
        const worksheet = workbook.Sheets['Projects'];
        const data = XLSX.utils.sheet_to_json(worksheet, { defval: '', range: 2 });

        // Add new project (will be added below the headers)
        const newRow = HEADERS.reduce((acc, header) => {
            acc[header] = '';
            return acc;
        }, {});

        newRow['CONTRACT ID'] = projectData.contractId;
        newRow['CONTRACT NAME/LOCATION'] = projectData.contractDescription;
        newRow['TYPE OF PROJECT'] = projectData.category;
        newRow['APPROPRIATION'] = projectData.appropriation;
        newRow['APPROVED BUDGET COST (ABC)'] = projectData.approvedBudgetCost || '';
        newRow['CONTRACT AMOUNT'] = projectData.contractCost;
        newRow['LOCATION'] = projectData.location || '';
        newRow['CONTRACTOR'] = projectData.contractor;
        newRow['START DATE'] = projectData.startDate;
        newRow['EXPIRATION DATE'] = projectData.expirationDate;
        newRow['LATEST DATE UPDATED'] = projectData.completionDate;
        newRow['STATUS OF PROJECT'] = projectData.status || '';
        newRow['SWA (%) 1ST BILLING'] = projectData.accomplishment || '';
        newRow['INPUT 1ST BILLING'] = projectData.remarks || '';
        newRow['PROJECT ENGINEER'] = projectData.projectEngineer;
        newRow['MATERIALS ENGINEER'] = projectData.materialsEngineer;
        newRow['PROJECT INSPECTOR'] = projectData.projectInspector;
        newRow['QUALITY ASSURANCE IN-CHARGE'] = projectData.qaInCharge;
        newRow['RESIDENT ENGINEER'] = projectData.residentEngineer;
        newRow['CONTRACTORS MATERIALS ENGINEER'] = projectData.contractorMaterialsEngineer;

        data.push(newRow);

        // Create new worksheet with rows 1-3 as headers, then data
        const rows = data.map(row => HEADERS.map(h => row[h] ?? ''));
        const allData = [[], [], HEADERS, ...rows];
        const newWorksheet = XLSX.utils.aoa_to_sheet(allData);
        
        // Reapply formatting to rows 1-3
        const orangeFill = { fgColor: { rgb: 'FFA500' }, patternType: 'solid' };
        const orangeFont = { color: { rgb: 'FFFFFF' }, bold: true };
        
        for (let col = 0; col < HEADERS.length; col++) {
            const cellAddress1 = XLSX.utils.encode_cell({ r: 0, c: col });
            const cellAddress2 = XLSX.utils.encode_cell({ r: 1, c: col });
            const cellAddress3 = XLSX.utils.encode_cell({ r: 2, c: col });
            
            // Row 1 & 2
            if (!newWorksheet[cellAddress1]) newWorksheet[cellAddress1] = {};
            newWorksheet[cellAddress1].fill = orangeFill;
            newWorksheet[cellAddress1].font = orangeFont;
            
            if (!newWorksheet[cellAddress2]) newWorksheet[cellAddress2] = {};
            newWorksheet[cellAddress2].fill = orangeFill;
            newWorksheet[cellAddress2].font = orangeFont;
            
            // Row 3
            if (!newWorksheet[cellAddress3]) newWorksheet[cellAddress3] = {};
            newWorksheet[cellAddress3].fill = { fgColor: { rgb: 'E8F4F8' }, patternType: 'solid' };
            newWorksheet[cellAddress3].font = { bold: true, color: { rgb: '000000' } };
        }
        
        newWorksheet['!cols'] = HEADERS.map(() => ({ wch: 15 }));
        newWorksheet['!rows'] = [
            { hpx: 25 },
            { hpx: 25 },
            { hpx: 30 }
        ];
        
        workbook.Sheets['Projects'] = newWorksheet;
        XLSX.writeFile(workbook, excelFilePath);

        res.json({ success: true, message: 'Project saved successfully!' });
    } catch (error) {
        console.error('Error saving project:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update project by Contract ID
app.put('/api/update-project/:contractId', (req, res) => {
    try {
        const contractId = String(req.params.contractId || '').trim();
        if (!contractId) {
            return res.status(400).json({ success: false, error: 'Missing contractId' });
        }

        const projectData = req.body || {};
        const workbook = XLSX.readFile(excelFilePath);
        const worksheet = workbook.Sheets['Projects'];
        const data = XLSX.utils.sheet_to_json(worksheet, { defval: '', range: 2 });

        const index = data.findIndex(row => String(row['CONTRACT ID'] || '').trim() === contractId);
        if (index === -1) {
            return res.status(404).json({ success: false, error: 'Project not found' });
        }

        const existing = data[index];
        const pick = (val, fallback) => (val === undefined || val === null ? fallback : val);

        const updated = { ...existing };
        updated['CONTRACT ID'] = pick(projectData.contractId, existing['CONTRACT ID']);
        updated['CONTRACT NAME/LOCATION'] = pick(projectData.contractDescription, existing['CONTRACT NAME/LOCATION']);
        updated['TYPE OF PROJECT'] = pick(projectData.category, existing['TYPE OF PROJECT']);
        updated['APPROPRIATION'] = pick(projectData.appropriation, existing['APPROPRIATION']);
        updated['APPROVED BUDGET COST (ABC)'] = pick(projectData.approvedBudgetCost, existing['APPROVED BUDGET COST (ABC)']);
        updated['CONTRACT AMOUNT'] = pick(projectData.contractCost, existing['CONTRACT AMOUNT']);
        updated['LOCATION'] = pick(projectData.location, existing['LOCATION']);
        updated['CONTRACTOR'] = pick(projectData.contractor, existing['CONTRACTOR']);
        updated['START DATE'] = pick(projectData.startDate, existing['START DATE']);
        updated['EXPIRATION DATE'] = pick(projectData.expirationDate, existing['EXPIRATION DATE']);
        updated['LATEST DATE UPDATED'] = pick(projectData.completionDate, existing['LATEST DATE UPDATED']);
        updated['STATUS OF PROJECT'] = pick(projectData.status, existing['STATUS OF PROJECT']);
        updated['SWA (%) 1ST BILLING'] = pick(projectData.accomplishment, existing['SWA (%) 1ST BILLING']);
        updated['INPUT 1ST BILLING'] = pick(projectData.remarks, existing['INPUT 1ST BILLING']);
        updated['PROJECT ENGINEER'] = pick(projectData.projectEngineer, existing['PROJECT ENGINEER']);
        updated['MATERIALS ENGINEER'] = pick(projectData.materialsEngineer, existing['MATERIALS ENGINEER']);
        updated['PROJECT INSPECTOR'] = pick(projectData.projectInspector, existing['PROJECT INSPECTOR']);
        updated['QUALITY ASSURANCE IN-CHARGE'] = pick(projectData.qaInCharge, existing['QUALITY ASSURANCE IN-CHARGE']);
        updated['RESIDENT ENGINEER'] = pick(projectData.residentEngineer, existing['RESIDENT ENGINEER']);
        updated['CONTRACTORS MATERIALS ENGINEER'] = pick(projectData.contractorMaterialsEngineer, existing['CONTRACTORS MATERIALS ENGINEER']);

        data[index] = updated;

        const rows = data.map(row => HEADERS.map(h => row[h] ?? ''));
        const allData = [[], [], HEADERS, ...rows];
        const newWorksheet = XLSX.utils.aoa_to_sheet(allData);

        const orangeFill = { fgColor: { rgb: 'FFA500' }, patternType: 'solid' };
        const orangeFont = { color: { rgb: 'FFFFFF' }, bold: true };

        for (let col = 0; col < HEADERS.length; col++) {
            const cellAddress1 = XLSX.utils.encode_cell({ r: 0, c: col });
            const cellAddress2 = XLSX.utils.encode_cell({ r: 1, c: col });
            const cellAddress3 = XLSX.utils.encode_cell({ r: 2, c: col });

            if (!newWorksheet[cellAddress1]) newWorksheet[cellAddress1] = {};
            newWorksheet[cellAddress1].fill = orangeFill;
            newWorksheet[cellAddress1].font = orangeFont;

            if (!newWorksheet[cellAddress2]) newWorksheet[cellAddress2] = {};
            newWorksheet[cellAddress2].fill = orangeFill;
            newWorksheet[cellAddress2].font = orangeFont;

            if (!newWorksheet[cellAddress3]) newWorksheet[cellAddress3] = {};
            newWorksheet[cellAddress3].fill = { fgColor: { rgb: 'E8F4F8' }, patternType: 'solid' };
            newWorksheet[cellAddress3].font = { bold: true, color: { rgb: '000000' } };
        }

        newWorksheet['!cols'] = HEADERS.map(() => ({ wch: 15 }));
        newWorksheet['!rows'] = [
            { hpx: 25 },
            { hpx: 25 },
            { hpx: 30 }
        ];

        workbook.Sheets['Projects'] = newWorksheet;
        XLSX.writeFile(workbook, excelFilePath);
        deletePowRecord(contractId);

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete project by Contract ID
app.delete('/api/delete-project/:contractId', (req, res) => {
    try {
        const contractId = String(req.params.contractId || '').trim();
        if (!contractId) {
            return res.status(400).json({ success: false, error: 'Missing contractId' });
        }

        const workbook = XLSX.readFile(excelFilePath);
        const worksheet = workbook.Sheets['Projects'];
        const data = XLSX.utils.sheet_to_json(worksheet, { defval: '', range: 2 });

        const filtered = data.filter(row => String(row['CONTRACT ID'] || '').trim() !== contractId);

        if (filtered.length === data.length) {
            return res.status(404).json({ success: false, error: 'Project not found' });
        }

        const rows = filtered.map(row => HEADERS.map(h => row[h] ?? ''));
        const allData = [[], [], HEADERS, ...rows];
        const newWorksheet = XLSX.utils.aoa_to_sheet(allData);

        const orangeFill = { fgColor: { rgb: 'FFA500' }, patternType: 'solid' };
        const orangeFont = { color: { rgb: 'FFFFFF' }, bold: true };

        for (let col = 0; col < HEADERS.length; col++) {
            const cellAddress1 = XLSX.utils.encode_cell({ r: 0, c: col });
            const cellAddress2 = XLSX.utils.encode_cell({ r: 1, c: col });
            const cellAddress3 = XLSX.utils.encode_cell({ r: 2, c: col });

            if (!newWorksheet[cellAddress1]) newWorksheet[cellAddress1] = {};
            newWorksheet[cellAddress1].fill = orangeFill;
            newWorksheet[cellAddress1].font = orangeFont;

            if (!newWorksheet[cellAddress2]) newWorksheet[cellAddress2] = {};
            newWorksheet[cellAddress2].fill = orangeFill;
            newWorksheet[cellAddress2].font = orangeFont;

            if (!newWorksheet[cellAddress3]) newWorksheet[cellAddress3] = {};
            newWorksheet[cellAddress3].fill = { fgColor: { rgb: 'E8F4F8' }, patternType: 'solid' };
            newWorksheet[cellAddress3].font = { bold: true, color: { rgb: '000000' } };
        }

        newWorksheet['!cols'] = HEADERS.map(() => ({ wch: 15 }));
        newWorksheet['!rows'] = [
            { hpx: 25 },
            { hpx: 25 },
            { hpx: 30 }
        ];

        workbook.Sheets['Projects'] = newWorksheet;
        XLSX.writeFile(workbook, excelFilePath);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// -------------------------------------------------------------------------------------------------
// WASABI STORAGE ENDPOINTS (DOCUMENTS + GALLERY)
// -------------------------------------------------------------------------------------------------
app.get('/api/storage-status', (req, res) => {
    res.json({
        success: true,
        wasabiConfigured: Boolean(s3),
        bucket: WASABI_BUCKET || '',
        region: WASABI_REGION || '',
        publicUrl: WASABI_PUBLIC_URL || ''
    });
});

app.post('/api/upload-document', requireWasabi, upload.single('file'), async (req, res) => {
    const file = req.file;
    const { contractId, section, docName } = req.body || {};
    if (!file || !contractId || !section || !docName) {
        if (file?.path) fs.unlink(file.path, () => {});
        return res.status(400).json({ success: false, error: 'Missing file or metadata.' });
    }

    const key = buildDocumentKey(contractId, section, docName, file.originalname);
    try {
        await s3.send(new PutObjectCommand({
            Bucket: WASABI_BUCKET,
            Key: key,
            Body: fs.createReadStream(file.path),
            ContentType: file.mimetype || 'application/octet-stream',
            Metadata: {
                contractId: String(contractId || '').trim(),
                section: String(section || '').trim(),
                docName: String(docName || '').trim()
            }
        }));

        const url = await getObjectUrl(key);
        res.json({
            success: true,
            document: {
                contractId,
                section,
                docName,
                fileName: file.originalname,
                key,
                url,
                updatedAt: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error('Upload document failed:', err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        if (file?.path) fs.unlink(file.path, () => {});
    }
});

app.get('/api/documents/:contractId', requireWasabi, async (req, res) => {
    const contractId = String(req.params.contractId || '').trim();
    if (!contractId) return res.status(400).json({ success: false, error: 'Missing contractId.' });

    const prefix = `documents/${safeKeyPart(contractId)}/`;
    try {
        const objects = await listAllObjects(prefix);
        const latestByDoc = new Map();

        objects.forEach(obj => {
            const key = obj.Key || '';
            const parts = key.split('/');
            if (parts.length < 5) return;
            const section = decodeKeyPart(parts[2] || '');
            const docName = decodeKeyPart(parts[3] || '');
            if (!section || !docName) return;
            const id = `${section}||${docName}`;
            const existing = latestByDoc.get(id);
            if (!existing || (obj.LastModified && obj.LastModified > existing.lastModified)) {
                latestByDoc.set(id, {
                    section,
                    docName,
                    fileName: parts.slice(4).join('/'),
                    key,
                    lastModified: obj.LastModified || new Date(0)
                });
            }
        });

        const documents = await Promise.all(Array.from(latestByDoc.values()).map(async (item) => ({
            section: item.section,
            docName: item.docName,
            fileName: item.fileName,
            key: item.key,
            url: await getObjectUrl(item.key),
            updatedAt: item.lastModified ? item.lastModified.toISOString() : ''
        })));

        res.json({ success: true, documents });
    } catch (err) {
        console.error('List documents failed:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/documents', requireWasabi, async (req, res) => {
    const { contractId, section, docName } = req.body || {};
    if (!contractId || !section || !docName) {
        return res.status(400).json({ success: false, error: 'Missing contractId, section, or docName.' });
    }
    const prefix = `documents/${safeKeyPart(contractId)}/${safeKeyPart(section)}/${safeKeyPart(docName)}/`;
    try {
        const objects = await listAllObjects(prefix);
        await Promise.all(objects.map(obj => s3.send(new DeleteObjectCommand({
            Bucket: WASABI_BUCKET,
            Key: obj.Key
        }))));
        res.json({ success: true });
    } catch (err) {
        console.error('Delete document failed:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/documents-summary', requireWasabi, async (req, res) => {
    try {
        const workbook = XLSX.readFile(excelFilePath);
        const worksheet = workbook.Sheets['Projects'];
        const data = XLSX.utils.sheet_to_json(worksheet, { defval: '', range: 2 });
        const contractIds = data
            .map(row => String(row['CONTRACT ID'] || '').trim().toUpperCase())
            .filter(Boolean);
        const contractSet = new Set(contractIds);

        const totals = {};
        const uploaded = {};
        Object.keys(SECTION_DOCS).forEach(section => {
            totals[section] = contractIds.length * (SECTION_DOCS[section] || []).length;
            uploaded[section] = 0;
        });

        const objects = await listAllObjects('documents/');
        const seen = new Set();
        objects.forEach(obj => {
            const key = obj.Key || '';
            const parts = key.split('/');
            if (parts.length < 5) return;
            const contract = decodeKeyPart(parts[1] || '').toUpperCase();
            const section = decodeKeyPart(parts[2] || '');
            const docName = decodeKeyPart(parts[3] || '');
            if (!contract || !section || !docName) return;
            if (!contractSet.has(contract)) return;
            if (!SECTION_DOCS[section]) return;
            const id = `${contract}||${section}||${docName}`;
            if (seen.has(id)) return;
            seen.add(id);
            uploaded[section] += 1;
        });

        const totalAll = Object.values(totals).reduce((sum, val) => sum + val, 0);
        const uploadedAll = Object.values(uploaded).reduce((sum, val) => sum + val, 0);

        res.json({
            success: true,
            totals,
            uploaded,
            totalAll,
            uploadedAll
        });
    } catch (err) {
        console.error('Documents summary failed:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/upload-gallery', requireWasabi, upload.array('files', 30), async (req, res) => {
    const files = req.files || [];
    const { contractId } = req.body || {};
    if (!contractId || !files.length) {
        files.forEach(f => f?.path && fs.unlink(f.path, () => {}));
        return res.status(400).json({ success: false, error: 'Missing contractId or files.' });
    }

    try {
        const uploads = await Promise.all(files.map(async (file) => {
            const key = buildGalleryKey(contractId, file.originalname);
            await s3.send(new PutObjectCommand({
                Bucket: WASABI_BUCKET,
                Key: key,
                Body: fs.createReadStream(file.path),
                ContentType: file.mimetype || 'application/octet-stream',
                Metadata: {
                    contractId: String(contractId || '').trim()
                }
            }));
            return {
                name: file.originalname,
                key,
                url: await getObjectUrl(key),
                date: new Date().toISOString()
            };
        }));

        res.json({ success: true, photos: uploads });
    } catch (err) {
        console.error('Upload gallery failed:', err);
        res.status(500).json({ success: false, error: err.message });
    } finally {
        files.forEach(f => f?.path && fs.unlink(f.path, () => {}));
    }
});

app.get('/api/gallery/:contractId', requireWasabi, async (req, res) => {
    const contractId = String(req.params.contractId || '').trim();
    if (!contractId) return res.status(400).json({ success: false, error: 'Missing contractId.' });
    const prefix = `gallery/${safeKeyPart(contractId)}/`;
    try {
        const objects = await listAllObjects(prefix);
        const photos = await Promise.all((objects || []).map(async (obj) => ({
            name: (obj.Key || '').split('/').slice(2).join('/'),
            key: obj.Key,
            url: await getObjectUrl(obj.Key),
            date: obj.LastModified ? obj.LastModified.toISOString() : ''
        })));

        photos.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        res.json({ success: true, photos });
    } catch (err) {
        console.error('List gallery failed:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/gallery/:contractId', requireWasabi, async (req, res) => {
    const contractId = String(req.params.contractId || '').trim();
    if (!contractId) return res.status(400).json({ success: false, error: 'Missing contractId.' });
    const prefix = `gallery/${safeKeyPart(contractId)}/`;
    try {
        const objects = await listAllObjects(prefix);
        await Promise.all(objects.map(obj => s3.send(new DeleteObjectCommand({
            Bucket: WASABI_BUCKET,
            Key: obj.Key
        }))));
        res.json({ success: true });
    } catch (err) {
        console.error('Delete gallery failed:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get all projects
app.get('/api/get-projects', (req, res) => {
    try {
        const workbook = XLSX.readFile(excelFilePath);
        const worksheet = workbook.Sheets['Projects'];
        const data = XLSX.utils.sheet_to_json(worksheet, { defval: '', range: 2 });

        res.json({ success: true, projects: data });
    } catch (error) {
        console.error('Error reading projects:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Simple AI chat relay (uses OPENAI_API_KEY)
app.post('/api/chat', async (req, res) => {
    if (!OPENAI_API_KEY) {
        return res.status(503).json({ success: false, error: 'Chat is not configured. Missing OPENAI_API_KEY.' });
    }
    const userMessage = String(req.body?.message || '').trim();
    if (!userMessage) {
        return res.status(400).json({ success: false, error: 'Message is required.' });
    }
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant for DPWH projects dashboard. Keep replies concise (<=80 words).' },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.3,
                max_tokens: 180
            })
        });
        if (!response.ok) {
            const text = await response.text();
            return res.status(502).json({ success: false, error: 'Upstream error', detail: text });
        }
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content || '';
        res.json({ success: true, reply: content });
    } catch (err) {
        console.error('Chat error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Initialize and start server
initializeExcel();

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Excel file location: ${excelFilePath}`);
});
