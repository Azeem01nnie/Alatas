/**
 * Alatas Car Rental Services — Rental Agreement Terms
 * Coverage default: Zamboanga City (venue of actions under this agreement).
 */
export const COVERAGE_AREA = 'Zamboanga City'

export const CONTRACT_TERMS = [
  {
    title: 'Coverage Area',
    body: `The leased vehicle shall be used only within the territorial jurisdiction of ${COVERAGE_AREA}.

Any use of the vehicle outside the stated coverage without prior written notice and approval of the LESSOR shall subject the RENTER to a penalty of P10,000.00, without prejudice to investigation by proper authorities and further legal action.`,
  },
  {
    title: 'Fuel and Incidental Expenses',
    body: `All fuel expenses shall be for the exclusive account of the RENTER. Flat tires, vulcanizing charges, traffic violations, penalties, towing, parking fees, and other incidental expenses incurred during the rental period shall likewise be borne by the RENTER.`,
  },
  {
    title: 'Third-Party Liability',
    body: `Any damage, injury, loss, or liability caused to third parties or to the public arising from the use or operation of the vehicle shall be the sole responsibility of the RENTER, who shall indemnify and hold the LESSOR free from any claims.`,
  },
  {
    title: 'Prohibition Against Subleasing',
    body: `Subleasing, lending, or allowing the use of the vehicle by any unauthorized person is strictly prohibited. Violation shall result in a penalty of P5,000.00, in addition to termination of the contract and other legal remedies.`,
  },
  {
    title: 'Care, Cleanliness, and Misuse',
    body: `The RENTER shall exercise due diligence in the use of the vehicle, maintain its cleanliness, and avoid misuse or abuse. Smoking inside the vehicle is STRICTLY PROHIBITED. Any damage, stains, or deterioration occurring during the rental period shall be fully chargeable to the RENTER.`,
  },
  {
    title: 'Authorized Drivers Only',
    body: `Only duly licensed drivers approved by the LESSOR may operate the vehicle. Driving under the influence of alcohol, illegal drugs, or any prohibited substance is strictly forbidden and constitutes a serious breach of this Agreement.`,
  },
  {
    title: 'Prohibited Use',
    body: `The vehicle shall not be used:

• As public transport
• For carrying loads beyond its rated capacity
• For rallies, drag racing, off-road driving, or any hazardous activity
• For any illegal or unlawful purpose`,
  },
  {
    title: 'Tampering and Alteration',
    body: `Forging, falsifying, tampering with, replacing, or altering the vehicle’s identification details, plates, engine, chassis, GPS, or any component thereof is strictly prohibited and shall subject the RENTER to immediate legal action.`,
  },
  {
    title: 'Personal Belongings',
    body: `The LESSOR shall not be liable for any loss or damage to personal belongings left inside the vehicle, whether due to theft, accident, or negligence of the RENTER.`,
  },
  {
    title: 'Breach of Contract and Recovery',
    body: `Any breach of this Agreement grants the LESSOR the right to:

• Immediately reclaim or repossess the vehicle
• Terminate the rental
• Forfeit rental fees and deposits
• Pursue civil and/or criminal action`,
  },
  {
    title: 'Venue and Legal Fees',
    body: `Any legal action arising from this Agreement shall be filed exclusively in Zamboanga City. If the RENTER is found at fault, all legal fees, attorney’s fees, and related expenses shall be borne by the RENTER.`,
  },
  {
    title: 'Late Return Charges',
    body: `Any delay beyond the agreed return date and time shall be charged an additional fee equivalent to one (1) full rental period OR P200.00 per hour, computed from the agreed return time, whichever is higher, without prejudice to further legal remedies.`,
  },
  {
    title: 'Non-Refundability of Payments',
    body: `All payments made shall be considered non-refundable once the vehicle has been released, regardless of usage or early return, unless otherwise approved in writing by the LESSOR.`,
  },
  {
    title: 'Failure to Return Vehicle',
    body: `Failure to return the vehicle on the agreed date and time shall be deemed unauthorized possession, and shall be sufficient ground for immediate recovery, repossession, and the filing of appropriate civil and criminal cases.`,
  },
  {
    title: 'Undertaking for Damages and Loss of Income',
    body: `The RENTER expressly undertakes to shoulder the daily rental cost of the vehicle during any period of disablement or loss of revenue/hooking opportunities caused by damage, accident, or misuse attributable to the RENTER, until the vehicle is fully repaired and restored to rentable condition.`,
  },
  {
    title: 'Lawful Use Undertaking',
    body: `The RENTER guarantees that the vehicle shall be used solely for lawful purposes, in strict compliance with all applicable laws, ordinances, rules, and regulations, and shall not be used for any illegal, unlawful, or prohibited activity.`,
  },
  {
    title: 'Confiscation and Severe Violation Clause',
    body: `Should the RENTER use or permit the use of the vehicle for any illegal or unlawful purpose resulting in confiscation, seizure, or impoundment by authorities, the RENTER agrees to:

• Pay liquidated damages in the amount of P100,000.00, and
• Replace the rented vehicle with a brand-new unit of the same or equivalent model, without prejudice to further civil or criminal liabilities.`,
  },
  {
    title: 'No Insurance Coverage',
    body: `NO INSURANCE DISCLOSURE, WAIVER, AND ASSUMPTION OF LIABILITY

The RENTER expressly acknowledges, confirms, and agrees that the rented vehicle is NOT COVERED BY ANY INSURANCE, including but not limited to Comprehensive, Collision, Own Damage, or Third-Party Liability Insurance, for the entire duration of the rental period.`,
  },
  {
    title: 'Full Assumption of Risk',
    body: `By accepting possession of the vehicle, the RENTER VOLUNTARILY AND KNOWINGLY ASSUMES FULL AND SOLE RESPONSIBILITY for any and all risks, loss, damage, accident, injury, death, theft, or liability arising from or related to the use, operation, custody, or possession of the vehicle, REGARDLESS OF CAUSE, including but not limited to:

• Vehicular accidents or collisions
• Theft or carnapping
• Acts or negligence of third parties
• Natural calamities or fortuitous events
• Mechanical failure occurring during the rental period`,
  },
  {
    title: 'Full Financial Responsibility',
    body: `In the absence of insurance coverage, the RENTER agrees to shoulder ONE HUNDRED PERCENT (100%) OF ALL COSTS, without limitation, including:

• Repair or replacement of the vehicle
• Total loss or market value of the vehicle
• Towing, recovery, storage, and impounding fees
• Loss of rental income during repair or downtime
• Third-party property damage or bodily injury claims
• Legal, administrative, and incidental expenses`,
  },
  {
    title: 'Waiver and Release of Claims',
    body: `The RENTER hereby WAIVES, RELEASES, AND FOREVER DISCHARGES the LESSOR from any and all claims, demands, or causes of action arising from or related to the absence of insurance coverage.`,
  },
  {
    title: 'Informed and Voluntary Consent',
    body: `The RENTER confirms that:

• The absence of insurance coverage was fully disclosed and clearly explained prior to rental.
• The RENTER was given the option NOT TO PROCEED with the rental.
• The RENTER VOLUNTARILY ACCEPTED the rental under these conditions.`,
  },
  {
    title: 'Binding Effect',
    body: `This No-Insurance Disclosure and Assumption of Liability shall be binding, enforceable, and shall survive the termination or completion of this Agreement.`,
  },
]

export function formatContractTerm(term, index) {
  if (typeof term === 'string') return `${index + 1}. ${term}`
  return `${index + 1}. ${term.title}\n\n${term.body}`
}

export const LIABILITY_CLAUSE =
  'I CONFIRM THAT I WAS INFORMED THAT THE VEHICLE HAS NO INSURANCE COVERAGE AND I ACCEPT THE FULL LIABILITY FOR ANY LOSS, DAMAGE, OR CLAIM ARISING FROM THE RENTAL, AND THAT I HAVE READ AND AGREED TO ALL TERMS ABOVE.'
