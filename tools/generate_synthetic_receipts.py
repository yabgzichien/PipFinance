#!/usr/bin/env python3
"""Generate realistic synthetic Malaysian tax receipts and invoices for LHDN YA 2025."""

import os
from pathlib import Path
import cairosvg

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "demo" / "receipts"
OUT_DIR.mkdir(parents=True, exist_ok=True)

def render_receipt(filename: str, svg_content: str, width: int = 600, height: int = 900):
    svg_path = OUT_DIR / f"{filename}.svg"
    png_path = OUT_DIR / f"{filename}.png"
    svg_path.write_text(svg_content, encoding="utf-8")
    cairosvg.svg2png(
        bytestring=svg_content.encode("utf-8"),
        write_to=str(png_path),
        output_width=width,
        output_height=height,
    )
    svg_path.unlink() # clean up intermediate svg
    print(f"✓ Generated synthetic receipt: {png_path.name}")

def get_popular_receipt() -> str:
    return """<svg width="600" height="850" viewBox="0 0 600 850" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="850" fill="#FAF9F5"/>
  <rect x="25" y="25" width="550" height="800" rx="8" fill="#FFFFFF" stroke="#E2DEC9" stroke-width="2"/>
  
  <style>
    .mono { font-family: 'Courier New', Courier, monospace; }
    .bold { font-weight: bold; }
  </style>

  <!-- Header -->
  <text x="300" y="80" text-anchor="middle" class="mono bold" font-size="24" fill="#111111">POPULAR BOOK CO. (M) SDN BHD</text>
  <text x="300" y="110" text-anchor="middle" class="mono" font-size="14" fill="#555555">Lot LG1.115, Sunway Pyramid Shopping Mall</text>
  <text x="300" y="130" text-anchor="middle" class="mono" font-size="14" fill="#555555">Bandar Sunway, 47500 Petaling Jaya, Selangor</text>
  <text x="300" y="150" text-anchor="middle" class="mono" font-size="14" fill="#555555">SST Reg No: W10-1808-32000456</text>
  <text x="300" y="170" text-anchor="middle" class="mono" font-size="14" fill="#555555">TEL: 03-7492 2188</text>

  <line x1="50" y1="190" x2="550" y2="190" stroke="#222222" stroke-width="2" stroke-dasharray="6 4"/>

  <!-- Metadata -->
  <text x="50" y="220" class="mono" font-size="14" fill="#333333">Date: 15/03/2025 14:22</text>
  <text x="380" y="220" class="mono" font-size="14" fill="#333333">Receipt: RC-994182</text>
  <text x="50" y="245" class="mono" font-size="14" fill="#333333">Cashier: Sarah K. (POS 03)</text>
  <text x="380" y="245" class="mono" font-size="14" fill="#333333">Member ID: P-882910</text>

  <line x1="50" y1="265" x2="550" y2="265" stroke="#222222" stroke-width="1.5"/>

  <!-- Table Header -->
  <text x="50" y="290" class="mono bold" font-size="15" fill="#111111">ITEM DESCRIPTION</text>
  <text x="360" y="290" class="mono bold" font-size="15" fill="#111111">QTY</text>
  <text x="460" y="290" class="mono bold" font-size="15" fill="#111111">TOTAL (RM)</text>

  <line x1="50" y1="305" x2="550" y2="305" stroke="#222222" stroke-width="1"/>

  <!-- Line Items -->
  <text x="50" y="340" class="mono" font-size="14" fill="#222222">Atomic Habits (James Clear)</text>
  <text x="375" y="340" class="mono" font-size="14" fill="#222222">1</text>
  <text x="500" y="340" class="mono" font-size="14" fill="#222222">48.00</text>

  <text x="50" y="375" class="mono" font-size="14" fill="#222222">Thinking, Fast and Slow</text>
  <text x="375" y="375" class="mono" font-size="14" fill="#222222">1</text>
  <text x="500" y="375" class="mono" font-size="14" fill="#222222">62.00</text>

  <text x="50" y="410" class="mono" font-size="14" fill="#222222">Faber-Castell Fineliner Set 10s</text>
  <text x="375" y="410" class="mono" font-size="14" fill="#222222">1</text>
  <text x="500" y="410" class="mono" font-size="14" fill="#222222">35.00</text>

  <text x="50" y="445" class="mono" font-size="14" fill="#222222">Oxford A5 Hardcover Journal (2pk)</text>
  <text x="375" y="445" class="mono" font-size="14" fill="#222222">1</text>
  <text x="500" y="445" class="mono" font-size="14" fill="#222222">45.00</text>

  <text x="50" y="480" class="mono" font-size="14" fill="#222222">Pilot Juice Gel Pen 0.5 Box</text>
  <text x="375" y="480" class="mono" font-size="14" fill="#222222">1</text>
  <text x="500" y="480" class="mono" font-size="14" fill="#222222">60.00</text>

  <line x1="50" y1="510" x2="550" y2="510" stroke="#222222" stroke-width="1"/>

  <!-- Totals -->
  <text x="300" y="540" class="mono" font-size="15" fill="#333333">SUBTOTAL (EXCL. TAX):</text>
  <text x="500" y="540" class="mono" font-size="15" fill="#333333">250.00</text>

  <text x="300" y="570" class="mono" font-size="15" fill="#333333">SST (0% Books/Exempt):</text>
  <text x="515" y="570" class="mono" font-size="15" fill="#333333">0.00</text>

  <line x1="280" y1="590" x2="550" y2="590" stroke="#222222" stroke-width="2"/>

  <text x="300" y="625" class="mono bold" font-size="20" fill="#111111">TOTAL (RM):</text>
  <text x="475" y="625" class="mono bold" font-size="22" fill="#111111">250.00</text>

  <line x1="280" y1="645" x2="550" y2="645" stroke="#222222" stroke-width="2"/>

  <text x="50" y="680" class="mono" font-size="14" fill="#444444">PAYMENT METHOD: Touch 'n Go eWallet</text>
  <text x="50" y="705" class="mono" font-size="14" fill="#444444">APPROVAL CODE: TNG-883921</text>
  <text x="50" y="730" class="mono" font-size="13" fill="#2A7B4C">★ ELIGIBLE FOR LHDN FORM BE TAX RELIEF (G9 LIFESTYLE)</text>

  <!-- Barcode -->
  <g transform="translate(150, 755)">
    <rect x="0" y="0" width="300" height="35" fill="#111111"/>
    <rect x="15" y="0" width="6" height="35" fill="#FFFFFF"/>
    <rect x="30" y="0" width="4" height="35" fill="#FFFFFF"/>
    <rect x="42" y="0" width="10" height="35" fill="#FFFFFF"/>
    <rect x="65" y="0" width="4" height="35" fill="#FFFFFF"/>
    <rect x="80" y="0" width="8" height="35" fill="#FFFFFF"/>
    <rect x="100" y="0" width="5" height="35" fill="#FFFFFF"/>
    <rect x="120" y="0" width="12" height="35" fill="#FFFFFF"/>
    <rect x="145" y="0" width="6" height="35" fill="#FFFFFF"/>
    <rect x="165" y="0" width="14" height="35" fill="#FFFFFF"/>
    <rect x="190" y="0" width="4" height="35" fill="#FFFFFF"/>
    <rect x="210" y="0" width="8" height="35" fill="#FFFFFF"/>
    <rect x="235" y="0" width="12" height="35" fill="#FFFFFF"/>
    <rect x="260" y="0" width="6" height="35" fill="#FFFFFF"/>
    <rect x="280" y="0" width="4" height="35" fill="#FFFFFF"/>
  </g>
  <text x="300" y="810" text-anchor="middle" class="mono" font-size="12" fill="#777777">THANK YOU FOR SHOPPING AT POPULAR</text>
</svg>
"""

def get_machines_invoice() -> str:
    return """<svg width="600" height="850" viewBox="0 0 600 850" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="850" fill="#FFFFFF"/>
  <rect x="20" y="20" width="560" height="810" rx="4" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="1.5"/>

  <style>
    .sans { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .mono { font-family: 'Courier New', Courier, monospace; }
    .bold { font-weight: bold; }
  </style>

  <!-- Header -->
  <text x="50" y="65" class="sans bold" font-size="24" fill="#000000">MACHINES SDN. BHD.</text>
  <text x="50" y="85" class="sans" font-size="12" fill="#555555">Apple Authorised Reseller &amp; Service Provider</text>
  <text x="50" y="102" class="sans" font-size="12" fill="#555555">Lot S-043, 2nd Floor, Mid Valley Megamall, 59200 Kuala Lumpur</text>
  <text x="50" y="119" class="sans" font-size="12" fill="#555555">Company No: 245199-K • SST ID: W10-1808-31014299</text>

  <rect x="420" y="45" width="130" height="40" rx="4" fill="#F0F4F2" stroke="#2AAB68" stroke-width="1.5"/>
  <text x="485" y="70" text-anchor="middle" class="sans bold" font-size="14" fill="#185E3E">e-INVOICE</text>

  <line x1="50" y1="140" x2="550" y2="140" stroke="#DDDDDD" stroke-width="1.5"/>

  <!-- Info Box -->
  <text x="50" y="170" class="sans bold" font-size="13" fill="#333333">TAX INVOICE NO:</text>
  <text x="170" y="170" class="mono" font-size="13" fill="#111111">INV-2025-0720-88412</text>

  <text x="50" y="195" class="sans bold" font-size="13" fill="#333333">DATE &amp; TIME:</text>
  <text x="170" y="195" class="mono" font-size="13" fill="#111111">20-JUL-2025 16:45:10</text>

  <text x="350" y="170" class="sans bold" font-size="13" fill="#333333">PAYMENT:</text>
  <text x="430" y="170" class="sans" font-size="13" fill="#111111">DuitNow / Online</text>

  <text x="350" y="195" class="sans bold" font-size="13" fill="#333333">IRBM UUID:</text>
  <text x="430" y="195" class="mono" font-size="11" fill="#111111">9F8A2B1-LHDN-25</text>

  <rect x="50" y="225" width="500" height="30" fill="#F4F6F5"/>
  <text x="60" y="245" class="sans bold" font-size="12" fill="#333333">ITEM DESCRIPTION</text>
  <text x="360" y="245" class="sans bold" font-size="12" fill="#333333">QTY</text>
  <text x="470" y="245" class="sans bold" font-size="12" fill="#333333">AMOUNT (RM)</text>

  <!-- Items -->
  <text x="60" y="285" class="sans bold" font-size="14" fill="#111111">Apple iPad Air 11-inch (M2) 128GB Wi-Fi</text>
  <text x="60" y="305" class="sans" font-size="12" fill="#666666">Space Grey • Model: MU9D3ZP/A • S/N: DLXQ8891J4</text>
  <text x="370" y="295" class="sans" font-size="14" fill="#111111">1</text>
  <text x="480" y="295" class="sans bold" font-size="14" fill="#111111">2,250.00</text>

  <line x1="50" y1="335" x2="550" y2="335" stroke="#EEEEEE" stroke-width="1"/>

  <text x="60" y="365" class="sans" font-size="13" fill="#222222">1-Year Apple Limited Warranty Coverage</text>
  <text x="370" y="365" class="sans" font-size="13" fill="#222222">1</text>
  <text x="495" y="365" class="sans" font-size="13" fill="#222222">INCL</text>

  <line x1="50" y1="400" x2="550" y2="400" stroke="#DDDDDD" stroke-width="1.5"/>

  <!-- Summary Box -->
  <g transform="translate(320, 420)">
    <text x="0" y="25" class="sans" font-size="14" fill="#555555">Subtotal (Excl. SST):</text>
    <text x="170" y="25" class="sans bold" font-size="14" fill="#111111">RM 2,250.00</text>

    <text x="0" y="55" class="sans" font-size="14" fill="#555555">SST (Exempt Computer):</text>
    <text x="170" y="55" class="sans bold" font-size="14" fill="#111111">RM 0.00</text>

    <line x1="0" y1="75" x2="230" y2="75" stroke="#222222" stroke-width="2"/>

    <text x="0" y="105" class="sans bold" font-size="16" fill="#142B20">TOTAL PAID:</text>
    <text x="140" y="105" class="sans bold" font-size="18" fill="#185E3E">RM 2,250.00</text>
  </g>

  <!-- LHDN Tax Stamp -->
  <rect x="50" y="560" width="500" height="120" rx="8" fill="#F2F9F5" stroke="#B8E2CB" stroke-width="1.5"/>
  <text x="70" y="590" class="sans bold" font-size="14" fill="#185E3E">LHDN MALAYSIA VALIDATED TAX RELIEF EVIDENCE</text>
  <text x="70" y="615" class="sans" font-size="12" fill="#333333">Pelepasan Cukai: G9 Gaya Hidup (Komputer peribadi, telefon pintar atau tablet)</text>
  <text x="70" y="635" class="sans" font-size="12" fill="#333333">YA 2025 Claim Amount: RM 2,250.00 (Cap: RM 2,500.00)</text>
  <text x="70" y="655" class="sans" font-size="12" fill="#555555">Digital Signature: Verified e-Invoice compliant with Section 82A Income Tax Act 1967</text>

  <!-- Footer note -->
  <text x="300" y="760" text-anchor="middle" class="sans" font-size="12" fill="#777777">Customer Careline: 1800-88-6224 • www.machines.com.my</text>
</svg>
"""

def get_decathlon_receipt() -> str:
    return """<svg width="600" height="850" viewBox="0 0 600 850" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="850" fill="#FAF9F5"/>
  <rect x="25" y="25" width="550" height="800" rx="8" fill="#FFFFFF" stroke="#E0E0E0" stroke-width="2"/>
  
  <style>
    .mono { font-family: 'Courier New', Courier, monospace; }
    .sans { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .bold { font-weight: bold; }
  </style>

  <text x="300" y="80" text-anchor="middle" class="sans bold" font-size="28" fill="#0082C3">DECATHLON</text>
  <text x="300" y="110" text-anchor="middle" class="mono bold" font-size="16" fill="#111111">DECATHLON MALAYSIA SDN BHD</text>
  <text x="300" y="130" class="mono" font-size="13" fill="#555555" text-anchor="middle">KL East Mall, 822 Jalan Lingkaran Tengah 2, KL</text>
  <text x="300" y="150" class="mono" font-size="13" fill="#555555" text-anchor="middle">SST ID: W10-1808-32001928</text>

  <line x1="50" y1="175" x2="550" y2="175" stroke="#333333" stroke-width="1.5" stroke-dasharray="5 3"/>

  <text x="50" y="205" class="mono" font-size="13" fill="#333333">DATE: 10/04/2025 11:30</text>
  <text x="350" y="205" class="mono" font-size="13" fill="#333333">RECEIPT: DEC-MY-9312</text>
  <text x="50" y="230" class="mono" font-size="13" fill="#333333">MEMBER: DEC-CLUB-7712</text>
  <text x="350" y="230" class="mono" font-size="13" fill="#333333">CASHIER: Aiman (POS 02)</text>

  <line x1="50" y1="250" x2="550" y2="250" stroke="#333333" stroke-width="1.5"/>

  <text x="50" y="275" class="mono bold" font-size="14" fill="#111111">SPORTS EQUIPMENT ITEM</text>
  <text x="370" y="275" class="mono bold" font-size="14" fill="#111111">QTY</text>
  <text x="470" y="275" class="mono bold" font-size="14" fill="#111111">RM</text>

  <line x1="50" y1="290" x2="550" y2="290" stroke="#CCCCCC" stroke-width="1"/>

  <text x="50" y="325" class="mono" font-size="14" fill="#222222">Kiprun Cushion Running Shoes (42)</text>
  <text x="385" y="325" class="mono" font-size="14" fill="#222222">1</text>
  <text x="475" y="325" class="mono" font-size="14" fill="#222222">220.00</text>

  <text x="50" y="360" class="mono" font-size="14" fill="#222222">Perfly BR 560 Badminton Racket</text>
  <text x="385" y="360" class="mono" font-size="14" fill="#222222">1</text>
  <text x="475" y="360" class="mono" font-size="14" fill="#222222">130.00</text>

  <text x="50" y="395" class="mono" font-size="14" fill="#222222">Aeroready Gym Training Shirts (2x)</text>
  <text x="385" y="395" class="mono" font-size="14" fill="#222222">2</text>
  <text x="475" y="395" class="mono" font-size="14" fill="#222222">100.00</text>

  <line x1="50" y1="430" x2="550" y2="430" stroke="#333333" stroke-width="1"/>

  <text x="300" y="465" class="mono bold" font-size="15" fill="#333333">SUBTOTAL:</text>
  <text x="475" y="465" class="mono bold" font-size="15" fill="#333333">450.00</text>

  <text x="300" y="495" class="mono" font-size="14" fill="#555555">SST (8% Included):</text>
  <text x="485" y="495" class="mono" font-size="14" fill="#555555">33.33</text>

  <line x1="280" y1="515" x2="550" y2="515" stroke="#111111" stroke-width="2"/>

  <text x="300" y="550" class="mono bold" font-size="20" fill="#111111">TOTAL PAID:</text>
  <text x="450" y="550" class="mono bold" font-size="22" fill="#0082C3">RM 450.00</text>

  <line x1="280" y1="570" x2="550" y2="570" stroke="#111111" stroke-width="2"/>

  <rect x="50" y="610" width="500" height="90" rx="6" fill="#F4F8FB" stroke="#BCE0F5" stroke-width="1.5"/>
  <text x="70" y="640" class="sans bold" font-size="13" fill="#005A87">LHDN TAX RELIEF: G10 SUKAN &amp; KECERGASAN</text>
  <text x="70" y="665" class="sans" font-size="12" fill="#333333">Eligible equipment purchase verified under YA 2025 (Cap: RM 1,000.00)</text>
  <text x="70" y="685" class="sans" font-size="12" fill="#555555">Payment: Maybank Debit Card • Auth: 881290</text>

  <text x="300" y="760" text-anchor="middle" class="mono" font-size="12" fill="#888888">SPORT FOR ALL • ALL FOR SPORT</text>
</svg>
"""

def get_anytime_fitness_invoice() -> str:
    return """<svg width="600" height="850" viewBox="0 0 600 850" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="850" fill="#FFFFFF"/>
  <rect x="25" y="25" width="550" height="800" rx="8" fill="#FFFFFF" stroke="#5E2D91" stroke-width="2"/>

  <style>
    .sans { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .mono { font-family: 'Courier New', Courier, monospace; }
    .bold { font-weight: bold; }
  </style>

  <!-- Header -->
  <text x="50" y="75" class="sans bold" font-size="24" fill="#5E2D91">ANYTIME FITNESS</text>
  <text x="50" y="98" class="sans" font-size="12" fill="#666666">AF Fitness Malaysia Sdn. Bhd. • SST No: B16-1808-32000118</text>
  <text x="50" y="115" class="sans" font-size="12" fill="#666666">Club Location: AF Bangsar South, Kuala Lumpur</text>

  <line x1="50" y1="135" x2="550" y2="135" stroke="#EEEEEE" stroke-width="1.5"/>

  <text x="50" y="170" class="sans bold" font-size="13" fill="#333333">INVOICE NUMBER:</text>
  <text x="180" y="170" class="mono" font-size="13" fill="#111111">AF-MY-2025-06-004128</text>

  <text x="50" y="195" class="sans bold" font-size="13" fill="#333333">BILLING DATE:</text>
  <text x="180" y="195" class="mono" font-size="13" fill="#111111">01/06/2025</text>

  <text x="350" y="170" class="sans bold" font-size="13" fill="#333333">MEMBER ID:</text>
  <text x="440" y="170" class="mono" font-size="13" fill="#111111">AF-992140</text>

  <rect x="50" y="225" width="500" height="30" fill="#F8F4FC"/>
  <text x="60" y="245" class="sans bold" font-size="12" fill="#5E2D91">MEMBERSHIP &amp; ACTIVITY DETAILS</text>
  <text x="460" y="245" class="sans bold" font-size="12" fill="#5E2D91">AMOUNT (RM)</text>

  <text x="60" y="290" class="sans bold" font-size="14" fill="#222222">Monthly Gym Membership (24/7 Worldwide Access)</text>
  <text x="60" y="310" class="sans" font-size="12" fill="#777777">Period: 01-Jun-2025 to 30-Jun-2025</text>
  <text x="480" y="295" class="sans bold" font-size="14" fill="#111111">220.00</text>

  <line x1="50" y1="335" x2="550" y2="335" stroke="#F0F0F0" stroke-width="1"/>

  <text x="60" y="365" class="sans bold" font-size="14" fill="#222222">Personal Training Coaching Session (1 Hour)</text>
  <text x="60" y="385" class="sans" font-size="12" fill="#777777">Certified Fitness Trainer Assessment</text>
  <text x="480" y="370" class="sans bold" font-size="14" fill="#111111">330.00</text>

  <line x1="50" y1="410" x2="550" y2="410" stroke="#DDDDDD" stroke-width="1.5"/>

  <g transform="translate(320, 430)">
    <text x="0" y="25" class="sans" font-size="14" fill="#555555">Subtotal:</text>
    <text x="170" y="25" class="sans bold" font-size="14" fill="#111111">RM 550.00</text>

    <text x="0" y="55" class="sans" font-size="14" fill="#555555">Service Tax (8%):</text>
    <text x="170" y="55" class="sans bold" font-size="14" fill="#111111">Included</text>

    <line x1="0" y1="75" x2="230" y2="75" stroke="#5E2D91" stroke-width="2"/>

    <text x="0" y="105" class="sans bold" font-size="16" fill="#5E2D91">TOTAL PAID:</text>
    <text x="140" y="105" class="sans bold" font-size="18" fill="#5E2D91">RM 550.00</text>
  </g>

  <!-- LHDN Note -->
  <rect x="50" y="570" width="500" height="90" rx="6" fill="#F8F4FC" stroke="#D1BBE7" stroke-width="1.5"/>
  <text x="70" y="600" class="sans bold" font-size="13" fill="#5E2D91">LHDN TAX RELIEF PELEPASAN: G10 SUKAN</text>
  <text x="70" y="625" class="sans" font-size="12" fill="#333333">Eligible gym membership &amp; fitness training fees for YA 2025.</text>
  <text x="70" y="645" class="sans" font-size="12" fill="#555555">Payment auto-debited via Recurring Commitment • Status: Paid</text>
</svg>
"""

def get_dental_cert() -> str:
    return """<svg width="600" height="850" viewBox="0 0 600 850" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="850" fill="#FFFFFF"/>
  <rect x="25" y="25" width="550" height="800" rx="8" fill="#FFFFFF" stroke="#007ACC" stroke-width="2"/>

  <style>
    .sans { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .mono { font-family: 'Courier New', Courier, monospace; }
    .bold { font-weight: bold; }
  </style>

  <text x="300" y="75" text-anchor="middle" class="sans bold" font-size="22" fill="#007ACC">KLINIK PERGIGIAN DENTAL CARE</text>
  <text x="300" y="98" text-anchor="middle" class="sans" font-size="12" fill="#555555">DR. TAN WEI LUN • BDS (Malaya), MDC Reg No. 58142</text>
  <text x="300" y="115" text-anchor="middle" class="sans" font-size="12" fill="#555555">42A, Jalan Telawi 3, Bangsar Baru, 59100 Kuala Lumpur • Tel: 03-2284 1900</text>

  <line x1="50" y1="135" x2="550" y2="135" stroke="#007ACC" stroke-width="1.5"/>

  <text x="300" y="165" text-anchor="middle" class="sans bold" font-size="15" fill="#111111">DENTAL EXAMINATION STATEMENT &amp; TAX RECEIPT</text>

  <text x="50" y="200" class="sans bold" font-size="13" fill="#333333">PATIENT NAME:</text>
  <text x="160" y="200" class="sans" font-size="13" fill="#111111">Yang (Taxpayer)</text>

  <text x="350" y="200" class="sans bold" font-size="13" fill="#333333">DATE:</text>
  <text x="410" y="200" class="mono" font-size="13" fill="#111111">18/05/2025</text>

  <text x="50" y="225" class="sans bold" font-size="13" fill="#333333">INVOICE NO:</text>
  <text x="160" y="225" class="mono" font-size="13" fill="#111111">DC-2025-0518-88</text>

  <text x="350" y="225" class="sans bold" font-size="13" fill="#333333">PRACTITIONER:</text>
  <text x="460" y="225" class="sans" font-size="12" fill="#111111">MDC Certified</text>

  <rect x="50" y="250" width="500" height="28" fill="#F0F8FF"/>
  <text x="60" y="268" class="sans bold" font-size="12" fill="#007ACC">DENTAL PROCEDURE / SERVICE</text>
  <text x="470" y="268" class="sans bold" font-size="12" fill="#007ACC">FEE (RM)</text>

  <text x="60" y="305" class="sans bold" font-size="13" fill="#222222">Comprehensive Dental Oral Examination</text>
  <text x="490" y="305" class="sans" font-size="13" fill="#111111">80.00</text>

  <text x="60" y="340" class="sans bold" font-size="13" fill="#222222">Full Mouth Ultrasonic Scaling &amp; Polishing</text>
  <text x="485" y="340" class="sans" font-size="13" fill="#111111">170.00</text>

  <text x="60" y="375" class="sans bold" font-size="13" fill="#222222">Diagnostic Bitewing Dental Radiograph (X-Ray)</text>
  <text x="485" y="375" class="sans" font-size="13" fill="#111111">100.00</text>

  <line x1="50" y1="400" x2="550" y2="400" stroke="#DDDDDD" stroke-width="1.5"/>

  <text x="320" y="435" class="sans bold" font-size="16" fill="#111111">TOTAL PAID (RM):</text>
  <text x="475" y="435" class="sans bold" font-size="18" fill="#007ACC">350.00</text>

  <!-- Practitioner certification stamp -->
  <rect x="50" y="475" width="500" height="150" rx="6" fill="#F9FCFF" stroke="#B8DCF5" stroke-width="1.5"/>
  <text x="70" y="505" class="sans bold" font-size="13" fill="#007ACC">MDC PRACTITIONER CERTIFICATION FOR LHDN FORM BE G6(iv)</text>
  <text x="70" y="530" class="sans" font-size="12" fill="#333333">I hereby certify that the dental examination and restorative treatment above was</text>
  <text x="70" y="548" class="sans" font-size="12" fill="#333333">performed by a registered dental practitioner under the Malaysian Dental Council (MDC).</text>
  
  <text x="70" y="585" class="sans bold" font-size="12" fill="#111111">Doctor's Stamp &amp; Signature: [DR. TAN WEI LUN • MDC 58142]</text>
  <text x="70" y="605" class="sans" font-size="12" fill="#2A7B4C">✓ Validated for LHDN Dental Relief (Capped at RM 1,000.00 per year)</text>
</svg>
"""

def get_gleneagles_receipt() -> str:
    return """<svg width="600" height="850" viewBox="0 0 600 850" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="850" fill="#FFFFFF"/>
  <rect x="25" y="25" width="550" height="800" rx="8" fill="#FFFFFF" stroke="#004B87" stroke-width="2"/>

  <style>
    .sans { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .mono { font-family: 'Courier New', Courier, monospace; }
    .bold { font-weight: bold; }
  </style>

  <text x="50" y="75" class="sans bold" font-size="22" fill="#004B87">GLENEAGLES HOSPITAL KUALA LUMPUR</text>
  <text x="50" y="98" class="sans" font-size="12" fill="#555555">Health Screening &amp; Diagnostic Wellness Centre</text>
  <text x="50" y="115" class="sans" font-size="12" fill="#555555">282 &amp; 286, Jalan Ampang, 50450 Kuala Lumpur • MOH Reg: KP/JSP/00142</text>

  <line x1="50" y1="135" x2="550" y2="135" stroke="#004B87" stroke-width="1.5"/>

  <text x="50" y="170" class="sans bold" font-size="13" fill="#333333">OFFICIAL RECEIPT NO:</text>
  <text x="210" y="170" class="mono" font-size="13" fill="#111111">GH-HSC-2025-0812-991</text>

  <text x="50" y="195" class="sans bold" font-size="13" fill="#333333">DATE OF SCREENING:</text>
  <text x="210" y="195" class="mono" font-size="13" fill="#111111">12-AUG-2025</text>

  <rect x="50" y="225" width="500" height="28" fill="#F0F4F8"/>
  <text x="60" y="244" class="sans bold" font-size="12" fill="#004B87">MEDICAL SCREENING PACKAGE DETAILS</text>
  <text x="470" y="244" class="sans bold" font-size="12" fill="#004B87">AMOUNT (RM)</text>

  <text x="60" y="285" class="sans bold" font-size="14" fill="#222222">Executive Wellness Screening Package</text>
  <text x="60" y="305" class="sans" font-size="12" fill="#666666">• Full Blood Count &amp; Lipid Profile</text>
  <text x="60" y="323" class="sans" font-size="12" fill="#666666">• Fasting Blood Glucose &amp; Renal Function</text>
  <text x="60" y="341" class="sans" font-size="12" fill="#666666">• Resting Electrocardiogram (ECG)</text>
  <text x="60" y="359" class="sans" font-size="12" fill="#666666">• Digital Chest X-Ray &amp; Medical Report</text>
  <text x="480" y="285" class="sans bold" font-size="14" fill="#111111">650.00</text>

  <line x1="50" y1="390" x2="550" y2="390" stroke="#DDDDDD" stroke-width="1.5"/>

  <text x="320" y="425" class="sans bold" font-size="16" fill="#111111">TOTAL AMOUNT PAID:</text>
  <text x="480" y="425" class="sans bold" font-size="18" fill="#004B87">RM 650.00</text>

  <rect x="50" y="475" width="500" height="110" rx="6" fill="#F4F8FB" stroke="#B8D2E7" stroke-width="1.5"/>
  <text x="70" y="505" class="sans bold" font-size="13" fill="#004B87">LHDN TAX RELIEF COMPLIANCE: FORM BE ITEM G7</text>
  <text x="70" y="530" class="sans" font-size="12" fill="#333333">Full medical check-up for self (Pelepasan pemeriksaan perubatan penuh)</text>
  <text x="70" y="550" class="sans" font-size="12" fill="#333333">Eligible YA 2025 deduction: RM 650.00 (within RM 1,000.00 sub-cap)</text>
  <text x="70" y="570" class="sans" font-size="12" fill="#555555">Payment Status: Settled via Credit Card</text>
</svg>
"""

def get_sspn_statement() -> str:
    return """<svg width="600" height="850" viewBox="0 0 600 850" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="850" fill="#FFFFFF"/>
  <rect x="25" y="25" width="550" height="800" rx="8" fill="#FFFFFF" stroke="#003366" stroke-width="2"/>

  <style>
    .sans { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .mono { font-family: 'Courier New', Courier, monospace; }
    .bold { font-weight: bold; }
  </style>

  <text x="300" y="75" text-anchor="middle" class="sans bold" font-size="20" fill="#003366">PERBADANAN TABUNG PENDIDIKAN TINGGI NASIONAL</text>
  <text x="300" y="98" text-anchor="middle" class="sans bold" font-size="16" fill="#006699">SKIM SIMPANAN PENDIDIKAN NASIONAL (SSPN-i PRIME)</text>
  <text x="300" y="118" text-anchor="middle" class="sans" font-size="12" fill="#555555">Resit Rasmi Deposit Simpanan &amp; Penyata Pelepasan Cukai LHDN</text>

  <line x1="50" y1="135" x2="550" y2="135" stroke="#003366" stroke-width="1.5"/>

  <text x="50" y="170" class="sans bold" font-size="13" fill="#333333">NO. AKAUN SSPN:</text>
  <text x="180" y="170" class="mono" font-size="13" fill="#111111">1000-8849-2910</text>

  <text x="350" y="170" class="sans bold" font-size="13" fill="#333333">TARIKH:</text>
  <text x="420" y="170" class="mono" font-size="13" fill="#111111">05/11/2025</text>

  <text x="50" y="195" class="sans bold" font-size="13" fill="#333333">NAMA PENDEPOSIT:</text>
  <text x="180" y="195" class="sans" font-size="13" fill="#111111">Yang (Pembayar Cukai)</text>

  <text x="350" y="195" class="sans bold" font-size="13" fill="#333333">NO. TRANSAKSI:</text>
  <text x="460" y="195" class="mono" font-size="11" fill="#111111">TXN-SSPN-2025-991</text>

  <rect x="50" y="225" width="500" height="28" fill="#EBF2F8"/>
  <text x="60" y="244" class="sans bold" font-size="12" fill="#003366">BUTIRAN TRANSAKSI SIMPANAN</text>
  <text x="470" y="244" class="sans bold" font-size="12" fill="#003366">JUMLAH (RM)</text>

  <text x="60" y="285" class="sans bold" font-size="14" fill="#222222">Deposit Simpanan Bersih SSPN-i Prime</text>
  <text x="60" y="305" class="sans" font-size="12" fill="#666666">Skim Simpanan Pendidikan Anak untuk Pelepasan Cukai</text>
  <text x="465" y="285" class="sans bold" font-size="14" fill="#111111">6,000.00</text>

  <line x1="50" y1="340" x2="550" y2="340" stroke="#DDDDDD" stroke-width="1.5"/>

  <text x="300" y="380" class="sans bold" font-size="16" fill="#111111">DEPOSIT BERSIH TAHUN 2025:</text>
  <text x="460" y="380" class="sans bold" font-size="18" fill="#003366">RM 6,000.00</text>

  <rect x="50" y="430" width="500" height="120" rx="6" fill="#F0F7FC" stroke="#A8CDE8" stroke-width="1.5"/>
  <text x="70" y="460" class="sans bold" font-size="13" fill="#003366">PENGESAHAN PELEPASAN CUKAI LHDN: BORANG BE G13</text>
  <text x="70" y="485" class="sans" font-size="12" fill="#333333">Simpanan bersih dalam Skim Simpanan Pendidikan Nasional (SSPN)</text>
  <text x="70" y="505" class="sans" font-size="12" fill="#333333">Had Maksimum Pelepasan: RM 8,000.00 setahun</text>
  <text x="70" y="525" class="sans" font-size="12" fill="#185E3E">✓ Status: Layak dituntut sepenuhnya untuk Tahun Taksiran 2025</text>
</svg>
"""

def get_prudential_statement() -> str:
    return """<svg width="600" height="850" viewBox="0 0 600 850" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="850" fill="#FFFFFF"/>
  <rect x="25" y="25" width="550" height="800" rx="8" fill="#FFFFFF" stroke="#ED1B2D" stroke-width="2"/>

  <style>
    .sans { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .mono { font-family: 'Courier New', Courier, monospace; }
    .bold { font-weight: bold; }
  </style>

  <text x="50" y="75" class="sans bold" font-size="24" fill="#ED1B2D">PRUDENTIAL BSN TAKAFUL</text>
  <text x="50" y="98" class="sans" font-size="12" fill="#555555">Prudential BSN Takaful Berhad (Company No: 740651-M)</text>
  <text x="50" y="115" class="sans" font-size="12" fill="#555555">Menara Prudential, Persiaran TRX, 55188 Kuala Lumpur</text>

  <line x1="50" y1="135" x2="550" y2="135" stroke="#ED1B2D" stroke-width="1.5"/>

  <text x="300" y="165" text-anchor="middle" class="sans bold" font-size="15" fill="#111111">ANNUAL TAX RELIEF STATEMENT FOR YA 2025</text>

  <text x="50" y="200" class="sans bold" font-size="13" fill="#333333">CERTIFICATE NO:</text>
  <text x="180" y="200" class="mono" font-size="13" fill="#111111">PRU-TAKAFUL-88129</text>

  <text x="350" y="200" class="sans bold" font-size="13" fill="#333333">DATE ISSUED:</text>
  <text x="445" y="200" class="mono" font-size="13" fill="#111111">15/01/2025</text>

  <rect x="50" y="225" width="500" height="28" fill="#FDF0F1"/>
  <text x="60" y="244" class="sans bold" font-size="12" fill="#ED1B2D">TAKAFUL BENEFIT SCHEDULE</text>
  <text x="460" y="244" class="sans bold" font-size="12" fill="#ED1B2D">PREMIUM (RM)</text>

  <text x="60" y="285" class="sans bold" font-size="14" fill="#222222">PruBSN An-Nur Medical &amp; Hospitalisation Rider</text>
  <text x="60" y="305" class="sans" font-size="12" fill="#666666">Annual Contribution paid for medical insurance</text>
  <text x="465" y="285" class="sans bold" font-size="14" fill="#111111">3,600.00</text>

  <line x1="50" y1="340" x2="550" y2="340" stroke="#DDDDDD" stroke-width="1.5"/>

  <text x="300" y="380" class="sans bold" font-size="16" fill="#111111">TOTAL QUALIFYING CONTRIBUTION:</text>
  <text x="460" y="380" class="sans bold" font-size="18" fill="#ED1B2D">RM 3,600.00</text>

  <rect x="50" y="430" width="500" height="120" rx="6" fill="#FFF5F5" stroke="#F5C6CB" stroke-width="1.5"/>
  <text x="70" y="460" class="sans bold" font-size="13" fill="#ED1B2D">LHDN TAX RELIEF CODE: FORM BE G4</text>
  <text x="70" y="485" class="sans" font-size="12" fill="#333333">Premium insurans perubatan dan pendidikan (Medical &amp; Education Insurance)</text>
  <text x="70" y="505" class="sans" font-size="12" fill="#333333">Pelepasan Cukai YA 2025 (Cap: RM 4,000.00 setahun)</text>
  <text x="70" y="525" class="sans" font-size="12" fill="#185E3E">✓ Qualifying contribution eligible for Form BE submission</text>
</svg>
"""

def get_childcare_receipt() -> str:
    return """<svg width="600" height="850" viewBox="0 0 600 850" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="600" height="850" fill="#FFFFFF"/>
  <rect x="25" y="25" width="550" height="800" rx="8" fill="#FFFFFF" stroke="#FFA500" stroke-width="2"/>

  <style>
    .sans { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
    .mono { font-family: 'Courier New', Courier, monospace; }
    .bold { font-weight: bold; }
  </style>

  <text x="300" y="75" text-anchor="middle" class="sans bold" font-size="22" fill="#E67E00">THE LITTLE CALIPHS KINDERGARTEN</text>
  <text x="300" y="98" text-anchor="middle" class="sans" font-size="12" fill="#555555">Pusat Jagaan Kanak-Kanak &amp; Tadika Berdaftar JKM/KPM</text>
  <text x="300" y="115" text-anchor="middle" class="sans" font-size="12" fill="#555555">JKM Reg No: JKM/WPKL/2021/8834 • KPM No: B4A8812</text>

  <line x1="50" y1="135" x2="550" y2="135" stroke="#FFA500" stroke-width="1.5"/>

  <text x="50" y="170" class="sans bold" font-size="13" fill="#333333">RECEIPT NO:</text>
  <text x="160" y="170" class="mono" font-size="13" fill="#111111">LC-2025-0201-44</text>

  <text x="350" y="170" class="sans bold" font-size="13" fill="#333333">DATE:</text>
  <text x="410" y="170" class="mono" font-size="13" fill="#111111">01/02/2025</text>

  <rect x="50" y="205" width="500" height="28" fill="#FFF9ED"/>
  <text x="60" y="224" class="sans bold" font-size="12" fill="#E67E00">FEE / TUITION PARTICULARS</text>
  <text x="470" y="224" class="sans bold" font-size="12" fill="#E67E00">FEES (RM)</text>

  <text x="60" y="265" class="sans bold" font-size="14" fill="#222222">Child Care &amp; Early Childhood Development Fees</text>
  <text x="60" y="285" class="sans" font-size="12" fill="#666666">Full Day Care &amp; Kindergarten Program</text>
  <text x="465" y="265" class="sans bold" font-size="14" fill="#111111">2,400.00</text>

  <line x1="50" y1="320" x2="550" y2="320" stroke="#DDDDDD" stroke-width="1.5"/>

  <text x="320" y="360" class="sans bold" font-size="16" fill="#111111">TOTAL PAID:</text>
  <text x="460" y="360" class="sans bold" font-size="18" fill="#E67E00">RM 2,400.00</text>

  <rect x="50" y="410" width="500" height="120" rx="6" fill="#FFFBF0" stroke="#FFE099" stroke-width="1.5"/>
  <text x="70" y="440" class="sans bold" font-size="13" fill="#E67E00">LHDN PELEPASAN CUKAI: BORANG BE ITEM G12</text>
  <text x="70" y="465" class="sans" font-size="12" fill="#333333">Yuran penghantaran anak ke pusat jagaan kanak-kanak / tadika berdaftar</text>
  <text x="70" y="485" class="sans" font-size="12" fill="#333333">Had Pelepasan Maksimum: RM 3,000.00 untuk seorang anak</text>
  <text x="70" y="505" class="sans" font-size="12" fill="#185E3E">✓ Resit rasmi sah laku untuk semakan audit LHDN</text>
</svg>
"""

def main():
    print("Generating 9 realistic synthetic Malaysian receipts in assets/demo/receipts/...")
    render_receipt("popular_bookstore_receipt", get_popular_receipt())
    render_receipt("machines_apple_invoice", get_machines_invoice())
    render_receipt("decathlon_sports_receipt", get_decathlon_receipt())
    render_receipt("anytime_fitness_invoice", get_anytime_fitness_invoice())
    render_receipt("klinik_dental_cert", get_dental_cert())
    render_receipt("gleneagles_checkup_receipt", get_gleneagles_receipt())
    render_receipt("sspn_deposit_statement", get_sspn_statement())
    render_receipt("prudential_insurance_statement", get_prudential_statement())
    render_receipt("little_caliphs_childcare_receipt", get_childcare_receipt())
    print("All synthetic receipts successfully generated.")

if __name__ == "__main__":
    main()
