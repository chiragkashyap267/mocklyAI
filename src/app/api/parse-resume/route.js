import { NextResponse } from 'next/server';
const { PDFParse } = require('pdf-parse');

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert the file to a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse the PDF using v2 API
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();

    return NextResponse.json({ 
      success: true, 
      text: result.text 
    });
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return NextResponse.json(
      { error: 'Failed to extract text from this PDF. It might be encrypted, scanned, or in an unsupported format. Please try another resume.' }, 
      { status: 422 }
    );
  }
}
