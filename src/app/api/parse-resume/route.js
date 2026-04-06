import { NextResponse } from 'next/server';
const PDFParser = require("pdf2json");

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use pdf2json for robust serverless Vercel parsing
    const extractedText = await new Promise((resolve, reject) => {
      const pdfParser = new PDFParser(this, 1);
      
      pdfParser.on("pdfParser_dataError", errData => reject(errData.parserError));
      pdfParser.on("pdfParser_dataReady", pdfData => {
        resolve(pdfParser.getRawTextContent().replace(/\r\n/g, ' '));
      });

      pdfParser.parseBuffer(buffer);
    });

    if (!extractedText || extractedText.trim().length < 10) {
       throw new Error("No readable text found.");
    }

    return NextResponse.json({ 
      success: true, 
      text: extractedText 
    });

  } catch (error) {
    console.error('Error parsing PDF:', error);
    return NextResponse.json(
      { error: 'Failed to extract text from this PDF. It might be encrypted, scanned, or in an unsupported format. Please try another resume.' }, 
      { status: 422 }
    );
  }
}
