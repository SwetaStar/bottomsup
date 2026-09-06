// Preset RFPs for the Setup screen. They are chosen to land in visibly
// different places on the scorecard and the gate, so a first-time user can
// see what drives the rating. SAMPLE_RFPS[0] is kept identical to
// data/01_SAMPLE_RFP.txt (the acceptance-test document).

export type SampleRFP = {
  id: string;
  label: string;
  sector: string;
  clientId: string;
  /** One line for the preset card. */
  blurb: string;
  /** What a first-time user should expect to see, in plain terms. */
  expect: string;
  budget: string;
  text: string;
};

const MERIDIAN = `REQUEST FOR PROPOSAL

Issuing organisation: Meridian Health Systems Pvt Ltd
Reference: MHS/RFP/2026/114
Issued: 12 August 2026
Response deadline: 5 September 2026, 17:00 IST
Submission format: PDF, maximum 25 pages excluding CVs and annexures

--------------------------------------------------------------------
1. BACKGROUND

Meridian Health Systems operates 14 multi-speciality hospitals across
five states in western and southern India, with approximately 6,200
staff and annual revenue of about Rs 2,400 crore. The group has grown
largely through acquisition over the past eight years. Each acquired
hospital has retained its own patient administration system, billing
process and procurement function.

The Board has approved a three-year operating-model transformation.
The first phase is a diagnostic and design engagement covering
procurement, patient throughput and shared services.

--------------------------------------------------------------------
2. SCOPE OF WORK

The selected advisor will be expected to deliver:

2.1  A current-state diagnostic of procurement across all 14 sites,
     including spend cube analysis, supplier fragmentation assessment
     and identification of consolidation opportunities.

2.2  A patient-throughput analysis for the six largest sites, covering
     outpatient scheduling, theatre utilisation and discharge process,
     with quantified improvement opportunities.

2.3  A shared-services design covering finance, HR administration and
     procurement operations, including a recommended operating model,
     location strategy and indicative business case.

2.4  A prioritised transformation roadmap with a benefits case, phased
     over 24 months, suitable for Board approval.

2.5  Support to the Board approval process, including two Board
     presentations.

--------------------------------------------------------------------
3. TIMELINE AND COMMERCIALS

Engagement start: 1 October 2026
Diagnostic and design phase: 14 weeks
Indicative budget: Rs 1.6 crore to Rs 2.1 crore for the first phase
Preferred commercial structure: fixed fee for the diagnostic phase,
with the option of outcome-linked fees on subsequent implementation
phases. Respondents proposing time-and-materials pricing should
justify why a fixed-fee structure is not appropriate.

--------------------------------------------------------------------
4. MANDATORY REQUIREMENTS

M1   Demonstrated healthcare provider experience in India, with at
     least two comparable engagements in the past four years.
M2   Named engagement partner with a minimum of twelve years of
     relevant experience, committed at no less than 30 percent.
M3   Ability to field a team on site across multiple states.
M4   Confirmation that no conflict exists with other hospital groups
     in the same catchment areas.
M5   Data protection undertaking covering patient-adjacent data. The
     advisor must confirm in writing whether any generative AI or
     automated tooling will be used in the delivery of the engagement,
     and on what terms.

--------------------------------------------------------------------
5. EVALUATION CRITERIA

Relevant sector experience and credentials          30 percent
Quality and specificity of proposed approach        25 percent
Team composition and named partner commitment       20 percent
Commercial structure and value for money            15 percent
Delivery risk and mobilisation speed                10 percent

--------------------------------------------------------------------
6. SUBMISSION

Responses to procurement@meridianhealth.example
Queries by 22 August 2026. A written Q&A will be circulated to all
respondents on 26 August 2026.

END OF DOCUMENT
`;

const BRIGHTFOLD = `REQUEST FOR PROPOSAL

Issuing organisation: Brightfold Retail Ltd
Reference: BRL/PROC/2026/207
Response deadline: 30 September 2026

--------------------------------------------------------------------
1. BACKGROUND

Brightfold Retail operates 190 speciality retail stores across India
with annual revenue of about Rs 3,400 crore. Store-level operating
costs have risen faster than sales for six consecutive quarters. The
back office has grown unevenly across three regional hubs following
two earlier acquisitions.

--------------------------------------------------------------------
2. SCOPE OF WORK

2.1  A store-level cost-to-operate analysis across all 190 stores,
     benchmarked by format and region.
2.2  A back-office consolidation design for finance, HR administration
     and indirect procurement, with a target operating model.
2.3  An indirect procurement review covering the top 20 categories.
2.4  An implementation roadmap with a benefits case over 18 months.

--------------------------------------------------------------------
3. TIMELINE AND COMMERCIALS

Engagement start: 20 October 2026
Diagnostic phase: 13 weeks
Indicative budget: Rs 1.1 crore to Rs 1.35 crore
Preferred commercial structure: fixed fee.

--------------------------------------------------------------------
4. MANDATORY REQUIREMENTS

M1   Demonstrated experience in retail or consumer operations cost
     transformation in India.
M2   Named engagement partner committed at no less than 30 percent.
M3   Ability to run store-level analysis at national scale.

--------------------------------------------------------------------
5. EVALUATION CRITERIA

Relevant sector experience and credentials          25 percent
Quality and specificity of proposed approach        30 percent
Team composition and named partner commitment       20 percent
Commercial structure and value for money            15 percent
Delivery risk and mobilisation speed                10 percent

END OF DOCUMENT
`;

const KESTREL = `REQUEST FOR PROPOSAL

Issuing organisation: Kestrel Diagnostics Chain
Reference: KDC/RFP/2026/041
Response deadline: 26 September 2026

--------------------------------------------------------------------
1. BACKGROUND

Kestrel Diagnostics operates a chain of pathology and imaging centres
in North India and has recently acquired six additional diagnostic
centres. Billing, procurement and patient administration are not yet
integrated across the acquired centres. Kestrel wishes to validate the
synergy case underpinning the acquisition and to stand up an
integration control tower.

--------------------------------------------------------------------
2. SCOPE OF WORK

2.1  Integration of billing, procurement and patient administration
     across the six acquired centres.
2.2  Validation of the synergy case against the acquisition model.
2.3  An integration control tower operating from week one.

--------------------------------------------------------------------
3. TIMELINE AND COMMERCIALS

Engagement start: 15 October 2026
Duration: 14 weeks
Indicative budget: Rs 1.2 crore to Rs 1.5 crore
Preferred commercial structure: fixed fee. The advisor will be
expected to price at least 20 percent below Kestrel's internal
benchmark of Rs 1.5 crore.

--------------------------------------------------------------------
4. MANDATORY REQUIREMENTS

M1   Demonstrated post-acquisition integration experience in
     healthcare or diagnostics in India.
M2   Named engagement partner committed at no less than 40 percent.
M3   The advisor must accept unlimited liability for any loss arising
     from the engagement, without a liability cap.
M4   The advisor must warrant that the integrated systems will deliver
     the full synergy figure in the acquisition model.

--------------------------------------------------------------------
5. EVALUATION CRITERIA

Relevant sector experience and credentials          25 percent
Quality and specificity of proposed approach        25 percent
Team composition and named partner commitment       20 percent
Commercial structure and value for money            20 percent
Delivery risk and mobilisation speed                10 percent

END OF DOCUMENT
`;

const PINNACLE = `REQUEST FOR PROPOSAL

Issuing organisation: Pinnacle Legal Advisory LLP
Reference: PLA/2026/RFP/09
Response deadline: 24 September 2026

--------------------------------------------------------------------
1. BACKGROUND

Pinnacle Legal Advisory is preparing for a large commercial dispute
and requires external support on litigation strategy and evidence
management. This is not an operations or management consulting
engagement.

--------------------------------------------------------------------
2. SCOPE OF WORK

2.1  Litigation support: assembly and indexing of the documentary
     record, chronology preparation and disclosure review.
2.2  Expert-witness coordination and management of expert reports.
2.3  Preparation of hearing bundles and support during the hearing.
2.4  Clinical protocol design review for one strand of the claim.

--------------------------------------------------------------------
3. TIMELINE AND COMMERCIALS

Engagement start: as soon as possible
Duration: approximately 10 weeks, intermittent
Indicative budget: Rs 15 lakh, firm ceiling
Preferred commercial structure: time and materials, capped.

--------------------------------------------------------------------
4. MANDATORY REQUIREMENTS

M1   Prior litigation support and disclosure-review experience.
M2   Availability of paralegal-grade resource at short notice.
M3   Acceptance of the Rs 15 lakh ceiling as firm.

--------------------------------------------------------------------
5. EVALUATION CRITERIA

Relevant experience and credentials                  30 percent
Quality and specificity of proposed approach         25 percent
Team composition                                     15 percent
Commercial structure and value for money             25 percent
Delivery risk                                         5 percent

END OF DOCUMENT
`;

const VELA = `REQUEST FOR PROPOSAL

Issuing organisation: Vela Financial Services Ltd
Reference: VFS/RFP/2026/188
Response deadline: 3 October 2026

--------------------------------------------------------------------
1. BACKGROUND

Vela Financial Services is a listed non-banking financial company with
about 7,400 staff and pan-India operations. Vela intends to redesign
its finance and HR operating model and consolidate transaction
processing into shared services, sequenced around the financial close
calendar.

--------------------------------------------------------------------
2. SCOPE OF WORK

2.1  Finance and HR shared-services design, including a recommended
     operating model and a location strategy across three cities.
2.2  A transition roadmap sequenced around the financial close
     calendar, in two waves.
2.3  A talent-availability study to ground the location strategy.
2.4  An indicative business case and run-rate cost model.

--------------------------------------------------------------------
3. TIMELINE AND COMMERCIALS

Engagement start: 20 October 2026
Duration: 12 weeks
Indicative budget: Rs 1.3 crore to Rs 1.6 crore
Preferred commercial structure: fixed fee.

--------------------------------------------------------------------
4. MANDATORY REQUIREMENTS

M1   Demonstrated shared-services and operating-model experience in
     financial services in India.
M2   Named engagement partner committed at no less than 30 percent.
M3   Ability to mobilise within three weeks of award.

--------------------------------------------------------------------
5. EVALUATION CRITERIA

Relevant sector experience and credentials          30 percent
Quality and specificity of proposed approach        25 percent
Team composition and named partner commitment       20 percent
Commercial structure and value for money            15 percent
Delivery risk and mobilisation speed                10 percent

END OF DOCUMENT
`;

export const SAMPLE_RFPS: SampleRFP[] = [
  {
    id: "meridian",
    label: "Meridian Health Systems",
    sector: "Healthcare provider",
    clientId: "CLI-MERIDIAN-NEW",
    blurb:
      "14-hospital operating-model diagnostic — procurement, patient throughput, shared services.",
    expect:
      "Core sector, scope maps cleanly to VCG service lines, healthy budget. Scores high, recommendation to pursue. New client, so the gate asks a human to confirm contract terms.",
    budget: "₹1.6–2.1 Cr",
    text: MERIDIAN,
  },
  {
    id: "brightfold",
    label: "Brightfold Retail",
    sector: "Retail (adjacent)",
    clientId: "CLI-BRIGHTFOLD",
    blurb:
      "Store-level cost-to-operate analysis and back-office consolidation across 190 stores.",
    expect:
      "Retail is an adjacent sector, not core, so the sector-fit score is capped around the middle. Everything else is solid. Expect a borderline result — pursue, likely with conditions.",
    budget: "₹1.1–1.35 Cr",
    text: BRIGHTFOLD,
  },
  {
    id: "kestrel",
    label: "Kestrel Diagnostics",
    sector: "Healthcare / diagnostics",
    clientId: "CLI-KESTREL",
    blurb:
      "Post-acquisition integration of six diagnostic centres, with an integration control tower.",
    expect:
      "The work fits, but the RFP demands unlimited liability and a below-benchmark price. Those trip escalation rules (E2, E4), which override the score regardless of how the criteria land.",
    budget: "₹1.2–1.5 Cr",
    text: KESTREL,
  },
  {
    id: "pinnacle",
    label: "Pinnacle Legal Advisory",
    sector: "Legal services (outside)",
    clientId: "CLI-PINNACLE-NEW",
    blurb:
      "Litigation support, disclosure review and expert-witness coordination for a commercial dispute.",
    expect:
      "Litigation support and clinical protocol design are outside VCG's capability, and ₹15 lakh is well below the profitable-delivery line. Expect a low weighted total and a recommendation to decline.",
    budget: "₹15 lakh",
    text: PINNACLE,
  },
  {
    id: "vela",
    label: "Vela Financial Services",
    sector: "Financial services (core)",
    clientId: "CLI-VELA",
    blurb:
      "Finance and HR shared-services design and a two-wave transition for a listed NBFC.",
    expect:
      "A strong opportunity on the scorecard — core sector, clean scope, good budget. But Vela's 2021 master agreement forbids third-party AI tooling, so the confidentiality gate blocks the draft at the end.",
    budget: "₹1.3–1.6 Cr",
    text: VELA,
  },
];

// Back-compat for the acceptance tests / earlier code.
export const SAMPLE_RFP = MERIDIAN;
export const SAMPLE_CLIENT_ID = "CLI-MERIDIAN-NEW";
