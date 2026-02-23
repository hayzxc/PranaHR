/**
 * Certificate Generation Route
 * Generates filled DOCX from the fumigation certificate template
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { auth } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');
const { BadRequestError } = require('../utils/errors');

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'certificate_template.docx');

// @route   POST /api/generate-certificate
// @desc    Generate a filled certificate DOCX
// @access  Private
router.post('/', auth, catchAsync(async (req, res) => {
    const {
        dateIssued,
        certificateNumber,
        treatmentNumber,
        consignmentLink,
        sealNumber,
        clientName,
        clientAddress,
        commodityDescription,
        commodityCountryOfOrigin,
        commodityQuantity,
        portOfLoading,
        destinationCountry,
        // Target of fumigation (multi-select)
        targetCommodity,
        targetContainer,
        targetPackaging,
        targetOther,
        targetOtherDetails,
        // Enclosure type (single-select)
        enclosureType,
        enclosureOtherDetails,
        // Treatment schedule
        dose,
        period,
        temperature,
        // Fumigation details
        appliedDose,
        period2,
        temperature2,
        placeOfFumigation,
        streetAddress,
        fumigationCommenced,
        fumigationCompleted,
        finalTlv,
        // Declaration
        fullName,
        signatureDate,
        accreditationNumber,
        // E-Signature (base64 PNG)
        signatureImage,
    } = req.body;

    // Validate required fields
    if (!certificateNumber || !clientName || !fullName) {
        throw new BadRequestError('Certificate number, client name, and full name are required');
    }

    // Read template
    if (!fs.existsSync(TEMPLATE_PATH)) {
        throw new BadRequestError('Certificate template not found on server');
    }

    const templateContent = fs.readFileSync(TEMPLATE_PATH, 'binary');
    const zip = new PizZip(templateContent);

    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '{', end: '}' },
    });

    // Build checkbox display values
    const checked = '☑';
    const unchecked = '☐';

    // Target of fumigation — multi-select
    const tgcomVal = targetCommodity ? checked : unchecked;
    const tgconVal = targetContainer ? checked : unchecked;
    const tgpVal = targetPackaging ? checked : unchecked;

    // Fill the template with values
    doc.render({
        'date issued(dd/mm/yyyy)': dateIssued || '',
        'Nomer Sertifikat': certificateNumber || '',
        'Treatment Number': treatmentNumber || '',
        'Consigment Link': consignmentLink || '',
        'seal number': sealNumber || '',
        'client_ name': clientName || '',
        'client address': clientAddress || '',
        'commodity description': commodityDescription || '',
        'commodity country of origin': commodityCountryOfOrigin || '',
        'commodity quantity': commodityQuantity || '',
        'port of loading': portOfLoading || '',
        'destination country': destinationCountry || '',
        'tgcom': tgcomVal,
        'tgcon': tgconVal,
        'tgp': tgpVal,
        'dose': dose || '',
        'period': period || '',
        'temperature': temperature || '',
        'applied dose': appliedDose || '',
        'period2': period2 || '',
        'temprature2': temperature2 || '',
        'place of fumigation': placeOfFumigation || '',
        'Alamat': streetAddress || '',
        'date and time fumigation commenced': fumigationCommenced || '',
        'date and time fumigation completed': fumigationCompleted || '',
        'final tlv': finalTlv || '',
        'full name': fullName || '',
        'date': signatureDate || '',
        'accreditation number': accreditationNumber || '',
    });

    // Now handle enclosure type checkboxes in raw XML
    // The template has Word SDT checkboxes for enclosure types
    // We need to modify the XML directly to check/uncheck them
    const outputZip = doc.getZip();
    let documentXml = outputZip.file('word/document.xml').asText();

    // Enclosure type mapping — find and toggle the SDT checkboxes
    const enclosureLabels = [
        { label: 'Sheeted enclosure', value: 'sheeted' },
        { label: 'Fumigation chamber', value: 'chamber' },
        { label: 'Un-sheeted container', value: 'unsheeted' },
    ];

    for (const enc of enclosureLabels) {
        const labelIdx = documentXml.indexOf(enc.label);
        if (labelIdx === -1) continue;

        // Find the SDT checkbox XML block before this label
        // Look backwards from the label position for the checkbox SDT
        const searchArea = documentXml.substring(Math.max(0, labelIdx - 2000), labelIdx);

        if (enclosureType === enc.value) {
            // Check: replace unchecked unicode (2610) with checked (2612)
            // and set w14:checked val to "1"
            const lastCheckboxIdx = searchArea.lastIndexOf('w14:val="2610"');
            if (lastCheckboxIdx > -1) {
                const absIdx = Math.max(0, labelIdx - 2000) + lastCheckboxIdx;
                documentXml = documentXml.substring(0, absIdx)
                    + 'w14:val="2612"'
                    + documentXml.substring(absIdx + 'w14:val="2610"'.length);
            }
            // Also set checked state
            const lastCheckedIdx = searchArea.lastIndexOf('w14:val="0"');
            if (lastCheckedIdx > -1) {
                const absIdx = Math.max(0, labelIdx - 2000) + lastCheckedIdx;
                documentXml = documentXml.substring(0, absIdx)
                    + 'w14:val="1"'
                    + documentXml.substring(absIdx + 'w14:val="0"'.length);
            }
        }
    }

    // Handle "Other" enclosure type
    if (enclosureType === 'other') {
        // Find the "Other" text for enclosure type (the second "Other" in the section)
        const enclosureOtherIdx = documentXml.indexOf('Other (provide details)', documentXml.indexOf('Sheeted'));
        if (enclosureOtherIdx > -1) {
            const searchArea = documentXml.substring(Math.max(0, enclosureOtherIdx - 2000), enclosureOtherIdx);
            const lastCheckboxIdx = searchArea.lastIndexOf('w14:val="2610"');
            if (lastCheckboxIdx > -1) {
                const absIdx = Math.max(0, enclosureOtherIdx - 2000) + lastCheckboxIdx;
                documentXml = documentXml.substring(0, absIdx)
                    + 'w14:val="2612"'
                    + documentXml.substring(absIdx + 'w14:val="2610"'.length);
            }
        }
    }

    // Handle Target "Other" checkbox
    if (targetOther) {
        const targetOtherIdx = documentXml.indexOf('Other (provide details)');
        if (targetOtherIdx > -1) {
            const searchArea = documentXml.substring(Math.max(0, targetOtherIdx - 2000), targetOtherIdx);
            const lastCheckboxIdx = searchArea.lastIndexOf('w14:val="2610"');
            if (lastCheckboxIdx > -1) {
                const absIdx = Math.max(0, targetOtherIdx - 2000) + lastCheckboxIdx;
                documentXml = documentXml.substring(0, absIdx)
                    + 'w14:val="2612"'
                    + documentXml.substring(absIdx + 'w14:val="0"'.length);
            }
        }
    }

    // Write back modified XML
    outputZip.file('word/document.xml', documentXml);

    // Embed e-signature image if provided
    if (signatureImage && signatureImage.startsWith('data:image/png;base64,')) {
        const base64Data = signatureImage.replace('data:image/png;base64,', '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // 1. Add image to word/media/
        outputZip.file('word/media/signature.png', imageBuffer);

        // 2. Add relationship in word/_rels/document.xml.rels
        const relsFile = outputZip.file('word/_rels/document.xml.rels');
        if (relsFile) {
            let relsXml = relsFile.asText();
            const relId = 'rIdSignature1';
            const newRel = `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/signature.png"/>`;
            relsXml = relsXml.replace('</Relationships>', newRel + '</Relationships>');
            outputZip.file('word/_rels/document.xml.rels', relsXml);

            // 3. Insert inline drawing XML near "Signature" section in document
            let docXml = outputZip.file('word/document.xml').asText();
            const sigIdx = docXml.indexOf('Signature');
            if (sigIdx > -1) {
                // Find the next empty paragraph after "Signature" to insert the image
                const afterSig = docXml.substring(sigIdx);
                // Look for a paragraph break after "Signature" label
                const nextParaMatch = afterSig.match(/<w:p[ >]/);
                if (nextParaMatch) {
                    const insertIdx = sigIdx + nextParaMatch.index;
                    // Insert a new paragraph with the signature image
                    // Image dimensions: 5cm wide x 2.5cm tall (in EMUs: 1cm = 360000)
                    const imgWidth = 1800000; // 5cm
                    const imgHeight = 900000;  // 2.5cm
                    const drawingXml = `<w:p><w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${imgWidth}" cy="${imgHeight}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="99" name="Signature"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="99" name="signature.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${imgWidth}" cy="${imgHeight}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
                    docXml = docXml.substring(0, insertIdx) + drawingXml + docXml.substring(insertIdx);
                    outputZip.file('word/document.xml', docXml);
                }
            }
        }
    }

    // Generate output buffer
    const outputBuffer = outputZip.generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
    });

    // Set headers and send
    const filename = `Certificate_${certificateNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', outputBuffer.length);

    res.send(outputBuffer);
}));

module.exports = router;
