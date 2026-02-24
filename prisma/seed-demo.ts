/**
 * Demo Seed Script - St Lucia Development
 * Creates realistic demo data for presentations:
 * - GeoJSON stands with coordinates
 * - 3 clients with complete profiles
 * - Reservations and installment plans
 * - Payment history
 */

import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables from .env file FIRST
config({ path: join(process.cwd(), '.env.local') });
config({ path: join(process.cwd(), '.env') });

// Import prisma AFTER env vars are loaded
const prismaModule = await import('../lib/prisma');
const prisma = prismaModule.default;

// St Lucia coordinates (Norton, Zimbabwe)
const ST_LUCIA_CENTER = { lat: -17.8833, lng: 30.7167 };

// Generate realistic stand polygons around the center point
function generateStandPolygon(baseIndex: number, rows: number, cols: number) {
  const row = Math.floor(baseIndex / cols);
  const col = baseIndex % cols;
  
  // Each stand is approximately 500sqm (0.05 hectares)
  const standWidth = 0.0003; // ~33m in degrees
  const standHeight = 0.0003; // ~33m in degrees
  const spacing = 0.00005; // 5m spacing
  
  const baseLat = ST_LUCIA_CENTER.lat + (row * (standHeight + spacing));
  const baseLng = ST_LUCIA_CENTER.lng + (col * (standWidth + spacing));
  
  // Create rectangular polygon (clockwise)
  return {
    type: 'Polygon',
    coordinates: [[
      [baseLng, baseLat], // bottom-left
      [baseLng + standWidth, baseLat], // bottom-right
      [baseLng + standWidth, baseLat + standHeight], // top-right
      [baseLng, baseLat + standHeight], // top-left
      [baseLng, baseLat] // close polygon
    ]]
  };
}

async function main() {
  console.log('🌱 Starting demo seed for St Lucia Development...\n');

  // Pre-generate all stand features for the GeoJSON
  const ROWS = 5;
  const COLS = 6;
  const standSizes = [300, 500, 800]; // small, medium, large
  const standPrices = [25000, 35000, 50000];
  
  const geoJsonFeatures = [];
  for (let i = 0; i < 30; i++) {
    const sizeIndex = i % 3;
    const size = standSizes[sizeIndex];
    const price = standPrices[sizeIndex];
    const standNumber = `SL-${String(i + 1).padStart(3, '0')}`;
    const status = i < 5 ? 'SOLD' : i < 8 ? 'RESERVED' : 'AVAILABLE';
    
    geoJsonFeatures.push({
      type: 'Feature',
      geometry: generateStandPolygon(i, ROWS, COLS),
      properties: {
        id: `stand-stlucia-${i + 1}`,
        stand_number: standNumber,
        standNumber: standNumber,
        status: status,
        size_sqm: size,
        price: price.toString(),
        price_per_sqm: Math.round(price / size).toString()
      }
    });
  }

  // 1. Find or create St Lucia development
  console.log('📍 Setting up St Lucia development...');
  const stLucia = await prisma.development.upsert({
    where: { id: 'dev-stlucia-demo' },
    update: {
      // Update geoJsonData on re-seed
      geoJsonData: {
        type: 'FeatureCollection',
        name: 'St Lucia Development',
        center: { lat: ST_LUCIA_CENTER.lat, lng: ST_LUCIA_CENTER.lng },
        features: geoJsonFeatures
      }
    },
    create: {
      id: 'dev-stlucia-demo',
      name: 'St Lucia',
      location: 'Norton, Mashonaland West',
      description: 'Premium residential development in Norton with modern amenities and infrastructure',
      overview: 'St Lucia offers modern living in a serene environment with all essential amenities and infrastructure',
      phase: 'READY_TO_BUILD',
      servicingProgress: 75,
      status: 'Active',
      basePrice: 25000,
      pricePerSqm: 50,
      vatPercentage: 15,
      endowmentFee: 500,
      totalStands: 30,
      availableStands: 22,
      mainImage: 'https://utfs.io/f/demo-stlucia-main.jpg',
      gallery: [],
      geoJsonData: {
        type: 'FeatureCollection',
        name: 'St Lucia Development',
        center: { lat: ST_LUCIA_CENTER.lat, lng: ST_LUCIA_CENTER.lng },
        features: geoJsonFeatures
      },
      imageUrls: [],
      documentUrls: [],
      standSizes: { small: 300, medium: 500, large: 800 },
      standTypes: ['Residential'],
      features: [
        'Tarred roads',
        'Electricity connection',
        'Water reticulation',
        'Sewer system',
        'Street lighting',
        'Security perimeter wall'
      ],
      commissionModel: { type: 'percentage', percentage: 5 },
      branch: 'Harare',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  });
  console.log(`✅ St Lucia development ready: ${stLucia.id}\n`);
  console.log(`   📍 GeoJSON features: ${geoJsonFeatures.length} stands\n`);

  // 2. Create 30 stands with GeoJSON data (5x6 grid)
  console.log('🏘️  Creating 30 stands with GeoJSON coordinates...');
  // Note: standSizes and standPrices already defined above
  const stands = [];

  for (let i = 0; i < 30; i++) {
    const sizeIndex = i % 3;
    const size = standSizes[sizeIndex];
    const price = standPrices[sizeIndex];
    const standNumber = `SL-${String(i + 1).padStart(3, '0')}`;
    
    // First 5 stands sold, next 3 reserved, rest available
    const status = i < 5 ? 'SOLD' : i < 8 ? 'RESERVED' : 'AVAILABLE';
    
    const stand = await prisma.stand.upsert({
      where: { id: `stand-stlucia-${i + 1}` },
      update: {},
      create: {
        id: `stand-stlucia-${i + 1}`,
        standNumber: standNumber,
        developmentId: stLucia.id,
        status: status,
        sizeSqm: size,
        price: price,
        pricePerSqm: Math.round(price / size),
        branch: 'Harare',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    stands.push(stand);
  }
  console.log(`✅ Created ${stands.length} stands with GeoJSON polygons\n`);

  // 3. Create 3 demo clients with complete profiles
  console.log('👥 Creating 3 demo clients...');
  
  const clients = await Promise.all([
    prisma.client.upsert({
      where: { id: 'client-demo-1' },
      update: {},
      create: {
        id: 'client-demo-1',
        name: 'Tafadzwa Moyo',
        firstName: 'Tafadzwa',
        lastName: 'Moyo',
        email: 'tafadzwa.moyo@example.com',
        phone: '+263 77 123 4567',
        nationalId: '63-1234567-A-12',
        branch: 'Harare',
        isPortalUser: true,
        kyc: [{
          type: 'ID',
          url: 'https://utfs.io/f/demo-kyc-1.pdf',
          status: 'VERIFIED'
        }],
        ownedStands: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }),
    prisma.client.upsert({
      where: { id: 'client-demo-2' },
      update: {},
      create: {
        id: 'client-demo-2',
        name: 'Rumbidzai Ncube',
        firstName: 'Rumbidzai',
        lastName: 'Ncube',
        email: 'rumbi.ncube@example.com',
        phone: '+263 77 234 5678',
        nationalId: '63-2345678-B-23',
        branch: 'Harare',
        isPortalUser: true,
        kyc: [{
          type: 'ID',
          url: 'https://utfs.io/f/demo-kyc-2.pdf',
          status: 'VERIFIED'
        }],
        ownedStands: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }),
    prisma.client.upsert({
      where: { id: 'client-demo-3' },
      update: {},
      create: {
        id: 'client-demo-3',
        name: 'Tendai Chikwanha',
        firstName: 'Tendai',
        lastName: 'Chikwanha',
        email: 'tendai.chik@example.com',
        phone: '+263 77 345 6789',
        nationalId: '63-3456789-C-34',
        branch: 'Harare',
        isPortalUser: true,
        kyc: [{
          type: 'ID',
          url: 'https://utfs.io/f/demo-kyc-3.pdf',
          status: 'VERIFIED'
        }],
        ownedStands: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })
  ]);
  console.log(`✅ Created ${clients.length} demo clients\n`);

  // 4. Create reservations for the 3 reserved stands
  console.log('📝 Creating reservations...');
  
  const reservedStands = stands.filter(s => s.status === 'RESERVED').slice(0, 3);
  
  for (let i = 0; i < 3; i++) {
    const client = clients[i];
    const stand = reservedStands[i];
    
    // Create reservation using upsert to handle re-runs
    const reservation = await prisma.reservation.upsert({
      where: { id: `reservation-demo-${i + 1}` },
      update: {
        standId: stand.id,
        clientId: client.id,
        status: 'CONFIRMED',
        termsAcceptedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000),
        timerActive: false,
        isCompanyLead: false,
        updatedAt: new Date()
      },
      create: {
        id: `reservation-demo-${i + 1}`,
        standId: stand.id,
        clientId: client.id,
        status: 'CONFIRMED',
        termsAcceptedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000),
        timerActive: false,
        isCompanyLead: false,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date()
      }
    });

    // Create deposit payment
    const depositAmount = Number(stand.price) * 0.1;
    await prisma.payment.upsert({
      where: { id: `payment-demo-deposit-${i + 1}` },
      update: {
        clientId: client.id,
        clientName: client.name,
        standId: stand.standNumber,
        amount: depositAmount,
        surchargeAmount: 0,
        paymentType: 'Deposit',
        method: 'Bank',
        status: 'CONFIRMED',
        officeLocation: 'Harare',
        verificationStatus: 'Verified',
        description: `Initial 10% deposit for ${stand.standNumber}`,
        updatedAt: new Date()
      },
      create: {
        id: `payment-demo-deposit-${i + 1}`,
        clientId: client.id,
        clientName: client.name,
        standId: stand.standNumber,
        amount: depositAmount,
        surchargeAmount: 0,
        paymentType: 'Deposit',
        method: 'Bank',
        status: 'CONFIRMED',
        officeLocation: 'Harare',
        reference: `DEP-STL-${Date.now()}-${i + 1}`,
        manualReceiptNo: `RCT-DEP-${String(1000 + i).slice(-3)}`,
        verificationStatus: 'Verified',
        description: `Initial 10% deposit for ${stand.standNumber}`,
        confirmedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date()
      }
    });

    // Create 3 installment payments (out of 12 planned)
    const installmentAmount = (Number(stand.price) * 0.9) / 12;
    for (let month = 1; month <= 3; month++) {
      const isCash = month % 2 === 0;
      await prisma.payment.upsert({
        where: { id: `payment-demo-inst-${i + 1}-${month}` },
        update: {
          clientId: client.id,
          clientName: client.name,
          standId: stand.standNumber,
          amount: installmentAmount,
          surchargeAmount: isCash ? 0 : installmentAmount * 0.05,
          paymentType: 'Installment',
          method: isCash ? 'Cash' : 'Bank',
          status: 'CONFIRMED',
          officeLocation: 'Harare',
          verificationStatus: 'Verified',
          description: `Installment ${month}/12 for ${stand.standNumber}`,
          receivedByName: isCash ? 'John Mushore' : undefined,
          updatedAt: new Date()
        },
        create: {
          id: `payment-demo-inst-${i + 1}-${month}`,
          clientId: client.id,
          clientName: client.name,
          standId: stand.standNumber,
          amount: installmentAmount,
          surchargeAmount: isCash ? 0 : installmentAmount * 0.05,
          paymentType: 'Installment',
          method: isCash ? 'Cash' : 'Bank',
          status: 'CONFIRMED',
          officeLocation: 'Harare',
          reference: `INST-STL-${Date.now()}-${i + 1}-${month}`,
          manualReceiptNo: `RCT-INST-${String(2000 + (i * 12) + month).slice(-4)}`,
          verificationStatus: 'Verified',
          description: `Installment ${month}/12 for ${stand.standNumber}`,
          receivedByName: isCash ? 'John Mushore' : undefined,
          confirmedAt: new Date(Date.now() - (30 - month * 7) * 24 * 60 * 60 * 1000),
          createdAt: new Date(Date.now() - (30 - month * 7) * 24 * 60 * 60 * 1000),
          updatedAt: new Date()
        }
      });
    }

    console.log(`  ✅ ${client.name} - ${stand.standNumber} - 3/12 installments paid`);
  }

  console.log(`\n✅ Created ${reservedStands.length} reservations with payment history\n`);

  // 5. Create Contract Templates
  console.log('📄 Creating contract templates...');
  
  const agreementOfSaleTemplate = await prisma.contractTemplate.upsert({
    where: { id: 'template-aos-demo' },
    update: {},
    create: {
      id: 'template-aos-demo',
      name: 'Agreement of Sale',
      description: 'Standard agreement of sale for residential stands',
      content: `
<h1 style="text-align: center; color: #8B7500; font-family: Georgia, serif;">AGREEMENT OF SALE</h1>
<p style="text-align: center; margin-bottom: 30px;"><strong>Fine & Country Zimbabwe (Private) Limited</strong></p>

<h2>PARTIES</h2>
<p><strong>THE SELLER:</strong> Fine & Country Zimbabwe (Private) Limited, a company duly incorporated in Zimbabwe.</p>
<p><strong>THE PURCHASER:</strong> {CLIENT_NAME}</p>
<p><strong>Email:</strong> {CLIENT_EMAIL}</p>
<p><strong>Phone:</strong> {CLIENT_PHONE}</p>

<h2>PROPERTY DETAILS</h2>
<p><strong>Development:</strong> St Lucia Estate, Norton</p>
<p><strong>Stand Number:</strong> {STAND_ID}</p>
<p><strong>Total Area:</strong> {STAND_SIZE} square meters</p>
<p><strong>Purchase Price:</strong> USD {STAND_PRICE}</p>

<h2>TERMS AND CONDITIONS</h2>

<h3>1. PURCHASE PRICE</h3>
<p>The total purchase price for the property is <strong>USD {STAND_PRICE}</strong> (United States Dollars), payable as follows:</p>
<ul>
  <li><strong>Deposit:</strong> 10% of purchase price ({DEPOSIT_AMOUNT}) due upon signing</li>
  <li><strong>Balance:</strong> 90% ({BALANCE_AMOUNT}) payable in 12 equal monthly installments</li>
</ul>

<h3>2. PAYMENT SCHEDULE</h3>
<p>Monthly installments of <strong>USD {MONTHLY_AMOUNT}</strong> are due on the 5th of each month, commencing from the month following the deposit payment.</p>

<h3>3. TITLE TRANSFER</h3>
<p>Transfer of title shall occur upon:</p>
<ul>
  <li>Full payment of the purchase price</li>
  <li>Payment of all applicable transfer fees and duties</li>
  <li>Compliance with all regulatory requirements</li>
</ul>

<h3>4. DEFAULT</h3>
<p>In the event of default in payment for a period exceeding 60 days, the Seller reserves the right to cancel this agreement and forfeit any payments made as damages.</p>

<h3>5. SERVICING</h3>
<p>The Seller undertakes to complete all servicing (water, sewer, roads, electricity) within 18 months of full payment.</p>

<h3>6. GOVERNING LAW</h3>
<p>This Agreement shall be governed by and construed in accordance with the laws of Zimbabwe.</p>

<h2>SIGNATURES</h2>
<div style="margin-top: 50px;">
  <p style="margin-bottom: 60px;"><strong>FOR THE SELLER:</strong></p>
  <p>___________________________ Date: _______________</p>
  <p>Fine & Country Zimbabwe (Private) Limited</p>
</div>

<div style="margin-top: 50px;">
  <p style="margin-bottom: 60px;"><strong>THE PURCHASER:</strong></p>
  <p>___________________________ Date: _______________</p>
  <p>{CLIENT_NAME}</p>
</div>

<div style="margin-top: 50px; text-align: center; border-top: 1px solid #ccc; padding-top: 20px;">
  <p style="font-size: 12px; color: #666;">Document generated on {DATE} | Reference: AOS-{STAND_ID}</p>
</div>
`,
      variables: ['CLIENT_NAME', 'CLIENT_EMAIL', 'CLIENT_PHONE', 'STAND_ID', 'STAND_SIZE', 'STAND_PRICE', 'DEPOSIT_AMOUNT', 'BALANCE_AMOUNT', 'MONTHLY_AMOUNT', 'DATE'],
      branch: 'Harare',
      status: 'ACTIVE'
    }
  });
  console.log('  ✅ Agreement of Sale template created');

  const paymentPlanTemplate = await prisma.contractTemplate.upsert({
    where: { id: 'template-pp-demo' },
    update: {},
    create: {
      id: 'template-pp-demo',
      name: 'Payment Plan Agreement',
      description: 'Payment schedule and installment plan agreement',
      content: `
<h1 style="text-align: center; color: #8B7500; font-family: Georgia, serif;">PAYMENT PLAN AGREEMENT</h1>
<p style="text-align: center; margin-bottom: 30px;"><strong>Fine & Country Zimbabwe</strong></p>

<h2>CLIENT DETAILS</h2>
<p><strong>Name:</strong> {CLIENT_NAME}</p>
<p><strong>Email:</strong> {CLIENT_EMAIL}</p>
<p><strong>Phone:</strong> {CLIENT_PHONE}</p>

<h2>PROPERTY</h2>
<p><strong>Stand:</strong> {STAND_ID} - St Lucia Estate, Norton</p>
<p><strong>Total Price:</strong> USD {STAND_PRICE}</p>

<h2>PAYMENT SCHEDULE</h2>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  <tr style="background: #8B7500; color: white;">
    <th style="padding: 10px; text-align: left;">Payment</th>
    <th style="padding: 10px; text-align: right;">Amount (USD)</th>
    <th style="padding: 10px; text-align: left;">Due Date</th>
    <th style="padding: 10px; text-align: left;">Status</th>
  </tr>
  <tr style="background: #f9f9f9;">
    <td style="padding: 10px;">Deposit (10%)</td>
    <td style="padding: 10px; text-align: right;">{DEPOSIT_AMOUNT}</td>
    <td style="padding: 10px;">Upon Signing</td>
    <td style="padding: 10px; color: green;">✓ Paid</td>
  </tr>
  <tr>
    <td style="padding: 10px;">Installment 1/12</td>
    <td style="padding: 10px; text-align: right;">{MONTHLY_AMOUNT}</td>
    <td style="padding: 10px;">5th Jan 2026</td>
    <td style="padding: 10px; color: green;">✓ Paid</td>
  </tr>
  <tr style="background: #f9f9f9;">
    <td style="padding: 10px;">Installment 2/12</td>
    <td style="padding: 10px; text-align: right;">{MONTHLY_AMOUNT}</td>
    <td style="padding: 10px;">5th Feb 2026</td>
    <td style="padding: 10px; color: orange;">Pending</td>
  </tr>
  <tr>
    <td style="padding: 10px;">Installment 3-12</td>
    <td style="padding: 10px; text-align: right;">{MONTHLY_AMOUNT} x 10</td>
    <td style="padding: 10px;">Monthly until Dec 2026</td>
    <td style="padding: 10px; color: gray;">Scheduled</td>
  </tr>
</table>

<h2>TERMS</h2>
<ul>
  <li>Payments must be made by the 5th of each month</li>
  <li>Late payments incur a 2% penalty fee</li>
  <li>Payments can be made via bank transfer or cash at our office</li>
  <li>Bank payments attract a 5% processing fee</li>
</ul>

<h2>BANK DETAILS</h2>
<p><strong>Bank:</strong> CBZ Bank</p>
<p><strong>Account Name:</strong> Fine & Country Zimbabwe</p>
<p><strong>Account Number:</strong> 12345678901</p>
<p><strong>Reference:</strong> {STAND_ID}-{CLIENT_NAME}</p>

<div style="margin-top: 50px;">
  <p><strong>Client Acknowledgment:</strong></p>
  <p style="margin-top: 40px;">___________________________ Date: _______________</p>
  <p>{CLIENT_NAME}</p>
</div>

<div style="margin-top: 30px; text-align: center; border-top: 1px solid #ccc; padding-top: 20px;">
  <p style="font-size: 12px; color: #666;">Generated: {DATE} | Fine & Country Zimbabwe</p>
</div>
`,
      variables: ['CLIENT_NAME', 'CLIENT_EMAIL', 'CLIENT_PHONE', 'STAND_ID', 'STAND_PRICE', 'DEPOSIT_AMOUNT', 'MONTHLY_AMOUNT', 'DATE'],
      branch: 'Harare',
      status: 'ACTIVE'
    }
  });
  console.log('  ✅ Payment Plan Agreement template created');

  // 6. Generate Contracts for Demo Clients
  console.log('\n📝 Generating contracts for demo clients...');

  for (let i = 0; i < reservedStands.length; i++) {
    const stand = reservedStands[i];
    const client = clients[i];
    const standPrice = Number(stand.price);
    const depositAmount = standPrice * 0.1;
    const balanceAmount = standPrice * 0.9;
    const monthlyAmount = balanceAmount / 12;

    // Substitutions for contract generation
    const substitutions: Record<string, string> = {
      '{CLIENT_NAME}': client.name,
      '{CLIENT_EMAIL}': client.email,
      '{CLIENT_PHONE}': client.phone || '',
      '{STAND_ID}': stand.standNumber,
      '{STAND_SIZE}': String(stand.sizeSqm || 0),
      '{STAND_PRICE}': standPrice.toLocaleString(),
      '{DEPOSIT_AMOUNT}': depositAmount.toLocaleString(),
      '{BALANCE_AMOUNT}': balanceAmount.toLocaleString(),
      '{MONTHLY_AMOUNT}': monthlyAmount.toLocaleString(),
      '{DATE}': new Date().toLocaleDateString('en-GB')
    };

    // Generate Agreement of Sale
    let aosContent = agreementOfSaleTemplate.content;
    for (const [key, value] of Object.entries(substitutions)) {
      aosContent = aosContent.replaceAll(key, value);
    }

    await prisma.generatedContract.upsert({
      where: { 
        clientId_standId_templateId: {
          clientId: client.id,
          standId: stand.standNumber,
          templateId: agreementOfSaleTemplate.id
        }
      },
      update: {
        content: aosContent,
        status: i === 0 ? 'SIGNED' : 'DRAFT',
        signedAt: i === 0 ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : null,
        signedBy: i === 0 ? client.name : null
      },
      create: {
        id: `contract-aos-${client.id}`,
        clientId: client.id,
        templateId: agreementOfSaleTemplate.id,
        standId: stand.standNumber,
        templateName: 'Agreement of Sale',
        content: aosContent,
        status: i === 0 ? 'SIGNED' : 'DRAFT',
        signedAt: i === 0 ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) : null,
        signedBy: i === 0 ? client.name : null,
        branch: 'Harare'
      }
    });

    // Generate Payment Plan
    let ppContent = paymentPlanTemplate.content;
    for (const [key, value] of Object.entries(substitutions)) {
      ppContent = ppContent.replaceAll(key, value);
    }

    await prisma.generatedContract.upsert({
      where: { 
        clientId_standId_templateId: {
          clientId: client.id,
          standId: stand.standNumber,
          templateId: paymentPlanTemplate.id
        }
      },
      update: {
        content: ppContent,
        status: 'SIGNED',
        signedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        signedBy: client.name
      },
      create: {
        id: `contract-pp-${client.id}`,
        clientId: client.id,
        templateId: paymentPlanTemplate.id,
        standId: stand.standNumber,
        templateName: 'Payment Plan Agreement',
        content: ppContent,
        status: 'SIGNED',
        signedAt: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
        signedBy: client.name,
        branch: 'Harare'
      }
    });

    console.log(`  ✅ ${client.name} - Agreement of Sale + Payment Plan contracts generated`);
  }

  console.log(`\n✅ Created ${reservedStands.length * 2} contracts (2 per client)\n`);

  // 7. Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🎉 DEMO DATA SEEDED SUCCESSFULLY!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`\n📊 Summary:`);
  console.log(`   Development: St Lucia (Norton)`);
  console.log(`   Total Stands: 30 (with GeoJSON polygons)`);
  console.log(`   - Available: 22`);
  console.log(`   - Reserved: 3 (with payment history)`);
  console.log(`   - Sold: 5`);
  console.log(`\n   Clients: 3 (verified with portal access)`);
  console.log(`   - Tafadzwa Moyo`);
  console.log(`   - Rumbidzai Ncube`);
  console.log(`   - Tendai Chikwanha`);
  console.log(`\n   Contracts: 6 total`);
  console.log(`   - 3 Agreements of Sale (1 signed, 2 draft)`);
  console.log(`   - 3 Payment Plan Agreements (all signed)`);
  console.log(`\n   Payments: 12 total`);
  console.log(`   - 3 deposits (10% of stand price)`);
  console.log(`   - 9 installments (3 per client, 9/12 remaining)`);
  console.log('\n═══════════════════════════════════════════════════════════\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
