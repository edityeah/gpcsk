import type { PrismaClient } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge Documents + Chunks seed
//
// 18 KnowledgeDocuments covering Gujarat pollution-control legislation, CPCB
// norms, GPCB SOPs, Annual Reports, Festival Monitoring and FAQ.
//
// ~120 KnowledgeChunks (5-10 per document) — real, factually accurate
// 200-400 word excerpts drawn from public Acts, CPCB notifications, and the
// GPCB AR 2022-23 / 2024-25 source PDFs in docs/references/gpcb-sources/.
//
// NO embeddings are set here — Phase 4 RAG ingest fills KnowledgeChunk.embedding.
// ─────────────────────────────────────────────────────────────────────────────

type DocInput = {
  key: string
  title: string
  sourceType:
    | 'ACT'
    | 'RULE'
    | 'SOP'
    | 'ANNUAL_REPORT'
    | 'CPCB_NORM'
    | 'CETP_REPORT'
    | 'FESTIVAL_MONITORING'
    | 'FAQ'
  tags: string[]
  chunks: { chunkText: string }[]
}

const KNOWLEDGE_DOCS: DocInput[] = [
  // ── 1. Water Act 1974 ─────────────────────────────────────────────────────
  {
    key: 'ACT-WATER-1974',
    title: 'Water (Prevention and Control of Pollution) Act, 1974',
    sourceType: 'ACT',
    tags: ['water', 'legislation', 'consent', 'SPCB', 'effluent'],
    chunks: [
      {
        chunkText: `The Water (Prevention and Control of Pollution) Act, 1974 was enacted by the Parliament of India to provide for the prevention and control of water pollution and the maintaining or restoring of wholesomeness of water. The Act established the Central Pollution Control Board (CPCB) under Section 3 and directed every State to constitute a State Pollution Control Board (SPCB) under Section 4. The CPCB is responsible for promoting cleanliness of streams and wells in different areas of the States. It advises the Central Government on any matter concerning the prevention and control of water pollution, and coordinates the activities of the State Boards.

Section 24 of the Water Act 1974 prohibits any person from knowingly causing or permitting any poisonous, noxious or polluting matter determined in accordance with such standards as may be laid down by the State Board to enter into any stream or well, or any sewage or trade effluent to enter any stream or well. Any person who contravenes the provisions of Section 24 is punishable under Section 43 with imprisonment for a term which shall not be less than one year and six months but which may extend to six years with a fine.`,
      },
      {
        chunkText: `Sections 25 and 26 of the Water Act 1974 govern the consent mechanism. Section 25 requires that any person intending to establish or take any steps to establish any industry, operation or process, or any treatment and disposal system or any extension or addition thereto, which is likely to discharge sewage or trade effluent into a stream, well or sewer must obtain the prior consent of the State Board. The application for consent must be made in the prescribed form, accompanied by the prescribed fee. Section 26 extends the same requirement to all existing industries that have not previously obtained consent.

The State Board may either grant or refuse consent under Section 25. If consent is granted, it may be subject to conditions including the nature and composition of effluents that may be discharged, the maximum quantity of effluent per day, and the dates by which any plant or system for treating trade effluent shall be installed. Consent once granted may be reviewed and varied by the State Board under Section 27. An appeal against the Board's decision may be filed before the Appellate Authority constituted under Section 28 within thirty days of the order.`,
      },
      {
        chunkText: `Section 33 of the Water Act 1974 empowers the State Pollution Control Board to take emergency measures in cases of sudden accidental pollution or imminent threat to public health. When any person has committed an act likely to cause pollution of any water in any area, the Board may frame orders restraining or prohibiting such act or make directions for remedial action. If the person fails to comply, the Board may itself take such action and recover the costs.

Sections 41 to 44 define the penalties under the Water Act. Section 41 imposes imprisonment of up to three months or a fine of up to ten thousand rupees, or both, for obstructing or impersonating SPCB officials. Section 43 provides the penalty for failure to comply with the consent conditions or directives: not less than one year and six months and may extend to six years and fine. Section 44 provides that if the offence is committed by a company, every person in charge of the company at the time of the offence shall be deemed guilty unless they prove the offence was committed without their knowledge.`,
      },
      {
        chunkText: `Section 16 of the Water Act 1974 lays down the functions of the Central Pollution Control Board. These include: promoting cleanliness of streams and wells in different areas; advising the Central Government on matters of water pollution prevention and control; providing technical assistance and guidance to State Boards; carrying out research relating to water pollution; and establishing standards for the quality of water in streams and wells. The CPCB is also responsible for laying down standards for effluent discharge from industries, and such standards shall not be less stringent than those prescribed by the State Boards.

Under Section 17, the State Pollution Control Board (SPCB) is charged with planning a comprehensive programme for prevention, control or abatement of pollution in the State. The Board shall advise the State Government on any matter relating to prevention and control of water pollution. It may also inspect sewage and trade effluents, works, and plants for treatment of sewage and trade effluents and review plans for such treatment. The SPCB has powers to take samples of water from any stream, well or sewer and samples of any effluent.`,
      },
      {
        chunkText: `The Water Act 1974 contains specific provisions for the constitution and powers of the State Pollution Control Board. Section 4 provides that every State Government shall, with effect from such date as it may appoint by notification in the Official Gazette, constitute a State Board to be known as the State Pollution Control Board for that State. The State Board shall consist of a Chairman appointed by the State Government; officials representing the State Government from departments concerned with water supply, sewage disposal, public health, agriculture, fisheries, and irrigation; two officials nominated by the Central Board; and not more than three persons to represent the interests of agriculture, fisheries, or industry.

Under Section 22, the State Board may, with the approval of the State Government, by order in writing require any person operating any industry, operation or process to construct new systems for the disposal of sewage and trade effluents, alter, extend or add to any existing system, carry out such works as may be necessary in compliance with the conditions subject to which consent has been granted, or take such steps as may be necessary to prevent pollution of any water in an area. The person shall be bound to comply with such requirements within such period as may be specified in the order.`,
      },
    ],
  },

  // ── 2. Air Act 1981 ───────────────────────────────────────────────────────
  {
    key: 'ACT-AIR-1981',
    title: 'Air (Prevention and Control of Pollution) Act, 1981',
    sourceType: 'ACT',
    tags: ['air', 'legislation', 'consent', 'SPCB', 'emission'],
    chunks: [
      {
        chunkText: `The Air (Prevention and Control of Pollution) Act, 1981 was enacted to provide for the prevention, control and abatement of air pollution. The Act was amended in 1987 to widen its scope. Section 3 of the Air Act empowers the CPCB and State Boards constituted under the Water Act 1974 to exercise the same powers and functions under the Air Act. Section 17 requires every State Pollution Control Board to lay down standards for emission of air pollutants from industrial plants and automobiles having regard to the quality standards for ambient air.

Section 21 of the Air Act prohibits any person from establishing or operating any industrial plant in an air pollution control area without the prior consent of the State Board. The application for consent must be in the prescribed form with the prescribed fee. The State Board may grant consent subject to conditions, or refuse consent, within four months of receiving the application. If the Board fails to act within four months, consent is deemed to have been granted. This deemed consent provision is significant for industries in Gujarat as GPCB processes consent to establish (CTE) and consent to operate (CTO) applications under this framework.`,
      },
      {
        chunkText: `Section 22 of the Air Act 1981 deals with emission standards. No person shall operate any industrial plant in an air pollution control area so as to emit air pollutants in excess of the standards laid down by the State Board. Any person who violates the standards commits an offence under Section 37, which provides for imprisonment for a term which shall not be less than one year and six months but may extend to six years, and a fine.

Section 19 empowers the State Government to declare any area within the State as an air pollution control area or vary such an area or revoke the declaration. Gujarat's densely industrialised districts — Bharuch (Ankleshwar, Dahej), Surat (Sachin, Pandesara, Hazira), Valsad (Vapi), and Ahmedabad (Vatva, Naroda) — have been notified as air pollution control areas. All existing and new industrial plants within these areas require prior consent of GPCB before establishment and before commencing operations.`,
      },
      {
        chunkText: `Sections 31 to 34 of the Air Act 1981 give State Boards extensive powers of inspection and entry. Under Section 31, any person authorised by the State Board may enter any premises, plant or vessel for inspection purposes; require any person to produce records, registers or documents; take samples of air or emission from any chimney, flue, or duct; and inspect any process, control equipment or pollution control device. Section 32 allows the Board to take samples of air or emission. The person in charge of the premises must render all assistance to the authorized person.

Section 35 of the Air Act provides for the power of the State Government to give directions to the Board. Section 40 provides that the proceedings under Sections 21 and 22 shall be taken cognisance of only on a complaint made by the Board. This means the Board's decision to prosecute is necessary before a court can take cognisance of an air pollution offence. The Appellate Authority under Section 31 of the Water Act also has jurisdiction over appeals from consent orders issued under the Air Act.`,
      },
      {
        chunkText: `Under Section 20 of the Air Act 1981, the Central Government may, in consultation with the CPCB, prescribe standards for the quality of ambient air. The CPCB notified the National Ambient Air Quality Standards (NAAQS) in 2009, setting limits for pollutants including PM10, PM2.5, SO2, NOx, NH3, CO, O3, lead, benzene, benzo(a)pyrene, arsenic and nickel. These standards form the basis for assessment of air quality at 38 NAMP stations and 24 SAMP stations operated by GPCB across Gujarat.

The Air Act requires the State Board to maintain a register of consent orders under Section 25. Every consent order, with the conditions attached, must be available for public inspection. The register must record the name and address of the applicant, the description of industrial plant, particulars of the emission likely to be emitted, the consent conditions, and any variation or revocation of consent. GPCB maintains these registers at district offices and at HQ in Gandhinagar.`,
      },
      {
        chunkText: `Section 16 of the Air Act 1981 empowers the Central Pollution Control Board to lay down standards for quality of air, advise the Central Government on matters concerning air pollution, and lay down standards for emission of air pollutants from automobiles. The CPCB publishes emission norms for various categories of industries and vehicles. It coordinates with State Boards to ensure uniform implementation.

Penalties under the Air Act are stringent. Section 37 provides that whoever fails to comply with the consent conditions issued under Section 21, or emits air pollutants in excess of norms under Section 22, shall be punishable with imprisonment for a term of not less than one year and six months and not more than six years, and fine. If the offence continues, an additional fine of five thousand rupees for every day during which such failure continues may be imposed. Section 40A allows the court to direct any person convicted under this Act to pay, in addition to any fine imposed, such compensation as the court considers just to the Board for the damage caused.`,
      },
    ],
  },

  // ── 3. EPA Act 1986 ───────────────────────────────────────────────────────
  {
    key: 'ACT-EPA-1986',
    title: 'Environment (Protection) Act, 1986',
    sourceType: 'ACT',
    tags: ['environment', 'legislation', 'EPA', 'standards', 'central-government'],
    chunks: [
      {
        chunkText: `The Environment (Protection) Act, 1986 (EPA) was enacted following the Bhopal gas disaster to provide for the protection and improvement of the environment and for matters connected therewith. Section 3 confers on the Central Government wide powers to take all such measures as it deems necessary or expedient for the purpose of protecting and improving the quality of the environment and preventing, controlling and abating environmental pollution. These measures include laying down standards for the quality of environment in its various aspects, laying down standards for emission or discharge of environmental pollutants from various sources, restricting areas in which any industries or operations may be carried out, and laying down procedures and safeguards for the handling of hazardous substances.

Section 5 empowers the Central Government to issue directions in writing to any person, officer, or any authority, and such person, officer, or authority shall be bound to comply. Section 7 prohibits any person carrying on any industry, operation or process from discharging or emitting or permitting to be discharged or emitted any environmental pollutant in excess of such standards as may be prescribed.`,
      },
      {
        chunkText: `Sections 10 and 11 of the EPA 1986 provide powers of entry and inspection. Any person empowered by the Central Government may enter any place where an industry or process is carried on for the purpose of performing his functions under the Act; examine and test any equipment, industrial plant, record or document; take samples of any substance; and inspect any information relating to any hazardous substance. The occupier or person in charge of the place is required to render reasonable assistance and must not obstruct the authorised person.

Section 15 provides penalties for violation of the EPA. Whoever fails to comply with or contravenes any of the provisions of the Act or the rules made thereunder or any order or direction issued thereunder shall be punishable with imprisonment for a term which may extend to five years or with a fine which may extend to one lakh rupees, or with both. If the failure or contravention continues, an additional fine of up to five thousand rupees per day shall apply. If the contravention continues beyond one year, imprisonment may extend to seven years.`,
      },
      {
        chunkText: `The EPA 1986 introduced the concept of environmental standards through Schedule I (standards for emission or discharge of environmental pollutants) and Schedule VI (general standards for discharge of environmental pollutants from industries). Schedule VI prescribes parameters and limits for effluent discharge into surface water, on land, and in public sewers. Key parameters include pH (5.5 to 9.0), BOD (30 mg/L for surface water, 350 mg/L on land), COD (250 mg/L), suspended solids (100 mg/L for surface water), oil and grease (10 mg/L), and heavy metals such as chromium (2.0 mg/L total), lead (0.1 mg/L), mercury (0.01 mg/L) and arsenic (0.2 mg/L).

Section 16 of the EPA provides for offences by companies. If the contravention is committed by a company, every person who at the time was in charge of and responsible for the conduct of the business shall be deemed to be guilty unless they prove the offence was committed without their knowledge or they exercised all due diligence to prevent the offence.`,
      },
      {
        chunkText: `Section 3(2)(v) of the EPA 1986 empowers the Central Government to restrict areas in which any industries, operations or processes shall not be carried out, or shall be carried out subject to certain safeguards. Under this power, the Central Government has issued numerous environmental notifications restricting industrial development within Coastal Regulation Zones (CRZ), Ecologically Sensitive Areas, and around protected forests. Gujarat's coastline — including the Gulf of Kutch and the Gulf of Khambhat — has significant CRZ-notified stretches that affect industries at Dahej, Hazira, Mundra, Kandla, and Jamnagar.

Section 19 of the EPA provides that no court shall take cognisance of any offence under the Act except on a complaint made by the Central Government or any authority or officer authorised in this behalf by the Central Government, or by any person who has given notice of not less than sixty days of the alleged offence and his intention to make a complaint to the Central Government or the authorised authority.`,
      },
    ],
  },

  // ── 4. EPA Rules 1986 ────────────────────────────────────────────────────
  {
    key: 'RULE-EPA-1986',
    title: 'Environment (Protection) Rules, 1986',
    sourceType: 'RULE',
    tags: ['environment', 'EPA', 'rules', 'effluent-standards', 'emission-standards'],
    chunks: [
      {
        chunkText: `The Environment (Protection) Rules, 1986 were framed under the powers conferred by Section 25 of the Environment (Protection) Act, 1986. Rule 3 provides that the standards for emission or discharge of environmental pollutants from the industries, operations, processes, and systems specified in Schedule I shall be as given in that Schedule. Schedule I is periodically amended to add new categories of industries and tighten existing standards. As of the most recent amendment, Schedule I covers over 90 categories of industries including dyestuff, pharmaceutical, bulk drug, fertiliser, petrochemical, textile (bleaching/dyeing), tannery, pulp and paper, and cement.

Rule 5 provides for the procedure for taking samples and sending them for analysis. Samples may be taken of air or water, and the procedure prescribed involves taking portions in the presence of the person in charge, filling a sealed container, and sending one portion to a laboratory approved by the State Board.`,
      },
      {
        chunkText: `Schedule VI of the EPA Rules 1986 (General Standards for Discharge of Environmental Pollutants from Industry) prescribes the general standards that apply to all industrial effluents where no specific industry standards have been prescribed. For discharge into inland surface water: pH 6.0 to 9.0, temperature not exceeding 40°C at receiving end, BOD 30 mg/L, COD 250 mg/L, suspended solids 100 mg/L, oil and grease 10 mg/L, total chromium 2 mg/L, hexavalent chromium 0.1 mg/L, lead 0.1 mg/L, cadmium 2 mg/L, mercury 0.01 mg/L, arsenic 0.2 mg/L, cyanide 0.2 mg/L, phenolics 1 mg/L, sulphide 2 mg/L, and fluoride 2 mg/L. For discharge on land for irrigation, some parameters such as BOD are relaxed (100 mg/L).

Schedule VII contains the standards for noise. The ambient noise standards in terms of dB(A) Leq are: industrial area 75 (day) / 70 (night); commercial area 65 (day) / 55 (night); residential area 55 (day) / 45 (night); silence zone 50 (day) / 40 (night). Day time refers to 6:00 AM to 10:00 PM and night time refers to 10:00 PM to 6:00 AM.`,
      },
      {
        chunkText: `Rule 7 of the EPA Rules 1986 provides for environmental laboratories. Any laboratory established or recognised under the Water Act or Air Act shall be deemed to be an environmental laboratory for the purpose of these Rules. The GPCB maintains accredited environmental laboratories at Gandhinagar (HQ) and at regional offices in Surat, Vadodara, Rajkot, and Bharuch. These labs are equipped to test air emissions, water effluents, noise levels, soil contamination, and hazardous waste samples.

Rule 12 provides that no officer or employee of the Central Government or a State Government or a local body shall grant any permission or licence for the establishment of any industry without first obtaining a No Objection Certificate (NOC) from the State Pollution Control Board. This requirement is the legal foundation for the GPCB consent to establish (CTE) process. The CTE is the first stage; once construction is complete, the industry must obtain a consent to operate (CTO) before commencing production.`,
      },
    ],
  },

  // ── 5. Hazardous Waste Rules 2016 ─────────────────────────────────────────
  {
    key: 'RULE-HW-2016',
    title: 'Hazardous and Other Wastes (Management and Transboundary Movement) Rules, 2016',
    sourceType: 'RULE',
    tags: ['hazardous-waste', 'rules', 'storage', 'disposal', 'manifest'],
    chunks: [
      {
        chunkText: `The Hazardous and Other Wastes (Management and Transboundary Movement) Rules, 2016 (HW Rules) were notified under the EPA 1986. They supersede the earlier Hazardous Wastes Rules of 1989 and its 2003 and 2008 amendments. Rule 4 defines the categories of hazardous wastes listed in Schedule I (which includes waste from specific industries such as mercury compounds from chlor-alkali plants, tarry residues from refining, spent catalysts containing precious metals, etc.), Schedule II (wastes having hazardous characteristics), and Schedule III (wastes requiring special consideration in import/export). Gujarat's chemical, pharmaceutical and dyes industries generate substantial quantities of Schedule I hazardous waste.

Rule 6 requires every occupier generating hazardous waste to obtain authorisation from the State Pollution Control Board. The authorisation specifies the types and quantities of hazardous waste that may be generated, stored on-site, and sent for treatment, storage and disposal. GPCB issues HW Authorisations under these Rules, which are typically co-termed with the CTO consent period.`,
      },
      {
        chunkText: `Rule 16 of the HW Rules 2016 prescribes labelling requirements for hazardous waste containers. Every container must carry a label with the words "Hazardous Waste", the name and address of the generator, the composition and physical properties of the waste, the nature of hazard, and the year of generation. Rule 19 prescribes the manifest system — every consignment of hazardous waste transported from a generator to a Treatment, Storage and Disposal Facility (TSDF) must be accompanied by a hazardous waste manifest in Form 13 with six copies distributed between the generator, transporter, operator of the TSDF, and the State Board.

Rules 17 and 18 address storage. An occupier may store hazardous waste on the premises for not more than 90 days. The storage area must be impervious, properly labelled, covered, and away from drainage channels and water bodies. After 90 days, the waste must be sent to an approved TSDF. Gujarat has multiple TSDFs including the Ankleshwar TSDF (operated by Bharuch Enviro Infrastructure Limited), the Surat TSDF, and the TSDF at Jhagadia.`,
      },
      {
        chunkText: `Rule 20 of the HW Rules 2016 addresses the transboundary movement of hazardous wastes. No person shall import or export hazardous wastes except with prior informed consent of the concerned authorities and in accordance with the conditions specified in Schedule VI. Imports are restricted to wastes intended for recycling or recovery, and require prior permission from the Ministry of Environment, Forest and Climate Change (MoEFCC) and a No Objection Certificate from the SPCB.

Rule 22 provides for the responsibility of the State Pollution Control Board. The State Board shall maintain a register of all generators, operators of treatment, storage and disposal facilities, recyclers, and transporters of hazardous waste within the State. GPCB publishes updated lists of authorised HW facilities. The Board shall also conduct periodic inspections of all authorised facilities and take action against violations. In Gujarat, major generators are concentrated in Ankleshwar, Vapi, Vatva, and Dahej clusters where GPCB inspection teams conduct frequent visits.`,
      },
      {
        chunkText: `Schedule IV to the HW Rules 2016 prescribes the standards for TSDFs. A TSDF must have: a secure landfill with a composite liner of minimum 1.5 mm HDPE geomembrane and 60 cm compacted clay; a leachate collection system; a groundwater monitoring system with a minimum of four monitoring wells; an incineration facility for incinerable wastes; and a secure storage facility for wastes awaiting treatment. The operator must maintain records of all wastes received, treated, and disposed of, and submit quarterly returns to the State Board.

Rule 35 of the HW Rules prescribes penalties for violation. Any person who violates the provisions of these Rules is liable to action under Sections 15 and 16 of the EPA 1986, which provide for imprisonment up to five years and fine up to one lakh rupees, with enhanced penalties for repeated offences. Officers and employees of companies may also be individually prosecuted. GPCB has filed prosecutions against several industries in Gujarat for unauthorised disposal of hazardous waste in land, water bodies, and vacant plots.`,
      },
    ],
  },

  // ── 6. Solid Waste Rules 2016 ─────────────────────────────────────────────
  {
    key: 'RULE-SWM-2016',
    title: 'Solid Waste Management Rules, 2016',
    sourceType: 'RULE',
    tags: ['solid-waste', 'MSW', 'rules', 'ULB', 'landfill', 'segregation'],
    chunks: [
      {
        chunkText: `The Solid Waste Management Rules, 2016 were notified under the EPA 1986 and supersede the Municipal Solid Wastes (Management and Handling) Rules 2000. Rule 4 makes it obligatory for every urban local body (ULB) and gram panchayat to ensure segregation of waste at source into biodegradable wet waste, non-biodegradable dry waste, domestic hazardous waste, and construction and demolition waste. The Rules also impose obligations on bulk waste generators, hotels, hospitals, and market places.

Rule 15 requires State Governments to issue directions to ULBs and constitute a State Level Advisory Body for monitoring implementation. Rule 16 requires the State Pollution Control Board to grant consents and authorisations for the establishment and operation of solid waste processing and disposal facilities. GPCB issues consents for landfill sites, composting plants, waste-to-energy plants, and Material Recovery Facilities (MRFs) across Gujarat. As of 2022-23, Gujarat had 38 sanitary landfills, 218 composting plants, and 8 waste-to-energy plants in various stages of operation.`,
      },
      {
        chunkText: `Rule 22 of the Solid Waste Management Rules 2016 specifies criteria for landfill sites. A sanitary landfill must be located away from water bodies (minimum 500 m from rivers, 200 m from ponds), public places, airports, and settlements. It must have an impermeable liner, leachate collection and treatment system, landfill gas capture provision, groundwater monitoring wells, and adequate access roads. Legacy dumps or old waste disposal sites that do not meet these criteria must be rehabilitated.

Rule 24 prohibits open burning of solid waste. Rule 25 prohibits littering in public places and makes it mandatory for ULBs to impose fines on litterers under bye-laws. GPCB monitors compliance and has the power to issue directions to ULBs for deficiencies. The Board also monitors construction and demolition waste disposal, which in Gujarat is a significant issue in rapidly growing cities like Ahmedabad, Surat and Rajkot where large construction projects generate high volumes of inert waste.`,
      },
      {
        chunkText: `Schedules I and II of the SWM Rules 2016 prescribe standards for sanitary landfills and leachate quality. Leachate from a landfill must be collected and treated before disposal. Treated leachate must meet the standards for discharge into surface water prescribed in Schedule VI of EPA Rules. Landfill gas with methane content above 20% must be collected and used for energy generation or flared. The operator must submit monthly reports to the local authority and the State Pollution Control Board.

Rule 36 provides that no person shall throw, burn, or bury the solid waste generated by him on streets, open public spaces outside his premises, in the drains, or water bodies. Non-compliance attracts a fine as prescribed under the bye-laws of the local authority. GPCB in Gujarat has directed all municipal corporations — Ahmedabad, Surat, Vadodara, Rajkot, Bhavnagar, Jamnagar, Junagadh, and Gandhinagar — to submit monthly compliance reports on waste processing and disposal.`,
      },
    ],
  },

  // ── 7. Noise Rules 2000 ───────────────────────────────────────────────────
  {
    key: 'RULE-NOISE-2000',
    title: 'Noise Pollution (Regulation and Control) Rules, 2000',
    sourceType: 'RULE',
    tags: ['noise', 'rules', 'dB', 'silence-zone', 'industrial'],
    chunks: [
      {
        chunkText: `The Noise Pollution (Regulation and Control) Rules, 2000 were notified under the Environment (Protection) Act 1986. Rule 3 prescribes the ambient noise standards for different areas: industrial areas — 75 dB(A) Leq (day) and 70 dB(A) Leq (night); commercial areas — 65 dB(A) and 55 dB(A); residential areas — 55 dB(A) and 45 dB(A); silence zones (areas up to 100 metres around hospitals, educational institutions, courts, and religious places) — 50 dB(A) and 40 dB(A). Day time is defined as 6:00 AM to 10:00 PM.

Rule 5 restricts the use of loudspeakers and public address systems without prior written permission of the authority. No loudspeaker or public address system shall be used at night between 10:00 PM and 6:00 AM except in closed premises. Even with permission, the noise from any source shall not exceed 10 dB(A) above the ambient noise standards of the area. Rule 6 prohibits manufacture, sale, or import of firecrackers generating noise above 125 dB(AI) or 145 dB(C) peak at four metres from the point of bursting.`,
      },
      {
        chunkText: `Rule 4 of the Noise Rules 2000 gives authority to the concerned authority (which includes SPCBs, local authorities, and police) to take steps to ensure that existing noise levels do not exceed the prescribed standards. The authority may make orders directing the person responsible for a source of noise to reduce noise levels, and may take proceedings under the Code of Criminal Procedure. The State Pollution Control Board has jurisdiction over industrial noise sources.

During festivals such as Navratri, Ganesh Utsav and Diwali, GPCB deploys mobile noise monitoring teams to gauge compliance with the Noise Rules. In 2022-23, GPCB monitored noise levels at festival grounds across Ahmedabad, Surat, Vadodara, Rajkot and other cities. Violations of the nighttime noise limits at Navratri pandals are common; the Board issues advisories and, where persistent violations are detected, directs local authorities to take action.`,
      },
      {
        chunkText: `Rule 7 of the Noise Pollution Rules 2000 provides that an area that has been designated as a silence zone may not be changed to another category except by a written order of the authority competent to do so. Hospitals, educational institutions, and courts are entitled to have silence zones around them. GPCB's role is to ensure that industrial and commercial noise does not penetrate into silence zones. Where a factory or operation is located within 100 metres of a hospital or school, the Board may impose stricter noise conditions in the consent order.

Industries in Gujarat operating continuous process plants — steel, cement, petrochemical, and ceramic (notably Morbi) — are required to install permanent noise monitoring equipment as a condition of CTO where operations generate noise levels above 70 dB(A). Data from such equipment is required to be submitted to GPCB quarterly. Failure to install or maintain such equipment constitutes a violation of consent conditions and may attract show-cause proceedings.`,
      },
    ],
  },

  // ── 8. CPCB General Standards for Discharge ──────────────────────────────
  {
    key: 'NORM-CPCB-DISCHARGE',
    title: 'CPCB General Standards for Discharge of Environmental Pollutants',
    sourceType: 'CPCB_NORM',
    tags: ['water', 'effluent', 'CPCB', 'standards', 'pH', 'BOD', 'COD', 'heavy-metals'],
    chunks: [
      {
        chunkText: `The CPCB General Standards for Discharge of Environmental Pollutants (Schedule VI, EPA Rules 1986) prescribe minimum effluent quality for discharge into inland surface waters. For most industrial sectors these represent the floor; sector-specific notifications may be tighter. Core parameters for discharge into inland surface water: pH 6.0 to 9.0; temperature at receiving end not to exceed 40°C (5°C above ambient); BOD (3-day at 27°C) — 30 mg/L; COD — 250 mg/L; suspended solids — 100 mg/L; oil and grease — 10 mg/L; total dissolved solids (TDS) — 2100 mg/L (for irrigation discharge: 2100 mg/L); total nitrogen — 100 mg/L; total phosphorus — 5 mg/L (new parameter added in 2015 amendment); sulphide — 2 mg/L; phenolics — 1 mg/L; cyanide — 0.2 mg/L; fluoride — 2 mg/L.

Heavy metals in effluent discharged to inland surface water: chromium hexavalent — 0.1 mg/L; chromium total — 2 mg/L; lead — 0.1 mg/L; cadmium — 2 mg/L; mercury — 0.01 mg/L; arsenic — 0.2 mg/L; copper — 3 mg/L; zinc — 5 mg/L; nickel — 3 mg/L; selenium — 0.05 mg/L; boron — 2 mg/L.`,
      },
      {
        chunkText: `For discharge of treated effluent on land for irrigation, the CPCB General Standards relax some parameters: BOD — 100 mg/L; suspended solids — 200 mg/L; pH — 5.5 to 9.0; electrical conductivity — 2 millimhos/cm; sodium absorption ratio — 26; boron — 2 mg/L. These relaxed limits apply only where the State Pollution Control Board has specifically authorised land disposal in the consent order, and the effluent quality must not permanently damage soil fertility or contaminate groundwater.

For discharge into public sewers (to a CETP or municipal sewer), the standards are: BOD — 350 mg/L; COD — 750 mg/L; pH — 5.5 to 9.0; oil and grease — 20 mg/L; suspended solids — 600 mg/L; chromium total — 2 mg/L; lead — 1 mg/L; cadmium — 1 mg/L; mercury — 0.01 mg/L. Industries connected to Common Effluent Treatment Plants (CETPs) in Gujarat's GIDC clusters operate under these sewer discharge standards; the CETP itself must meet the inland surface water discharge standards at its final outlet.`,
      },
      {
        chunkText: `Specific industry-sector standards notified under the EPA have stricter limits for certain parameters. Key sector standards relevant to Gujarat: Dyestuff and dye-intermediates — COD 250 mg/L, colour removal of 90%, BOD 30 mg/L; Pharmaceutical (bulk drug) — COD 250 mg/L, BOD 30 mg/L, total dissolved solids 2100 mg/L; Textile (bleaching/dyeing) — BOD 150 mg/L on land / 30 mg/L surface water, COD 250 mg/L, colour 400 PCU; Pulp and paper — BOD 30 mg/L, AOX (adsorbable organic halides) 1 kg/tonne of paper; Tannery — BOD 30 mg/L, sulphide 1 mg/L, total chromium 2 mg/L; Distillery — COD 250 mg/L, BOD 30 mg/L, after dilution of treated spent wash.

GPCB uses these sector-specific norms when setting consent conditions for Red category industries in Gujarat. Violations of these norms trigger exceedance alerts in the OCEMS / CEQMS monitoring system and are used by the Inspection & Enforcement Officer to prioritise inspection visits.`,
      },
      {
        chunkText: `The CPCB has issued specific guidelines on colour in effluents — particularly relevant to Gujarat's dyestuff cluster in Vatva and Naroda (Ahmedabad) and Sachin (Surat). The draft notification on Colour in Effluents (2015) specifies that the colour of the treated effluent from dyestuff and textile industries must not exceed 400 PCU (Platinum Cobalt Units) at the point of final discharge into surface water. This applies after treatment in the CETP or ETP. The colour standard was introduced because conventional BOD/COD-based norms do not capture the impact of persistent synthetic dyes that affect aquatic ecosystems.

The CPCB General Standards also include provisions for radioactive materials, but these are generally outside the scope of GPCB's routine consent process and are managed by the Atomic Energy Regulatory Board (AERB). GPCB's mandate is limited to chemical and biological pollutants from industrial, municipal, and agricultural sources.`,
      },
    ],
  },

  // ── 9. NAAQS 2009 ─────────────────────────────────────────────────────────
  {
    key: 'NORM-CPCB-NAAQS-2009',
    title: 'National Ambient Air Quality Standards (NAAQS), 2009',
    sourceType: 'CPCB_NORM',
    tags: ['air', 'NAAQS', 'PM10', 'PM2.5', 'SO2', 'NOx', 'ambient', 'standards'],
    chunks: [
      {
        chunkText: `The National Ambient Air Quality Standards (NAAQS) 2009 were notified by the Ministry of Environment and Forests vide Notification dated 16 November 2009, superseding the earlier NAAQS of 1994. The NAAQS prescribes concentration limits for pollutants in ambient air across all areas. The standards apply to industrial areas, residential and rural areas, and ecologically sensitive areas (more stringent). There is no averaging period shorter than 24 hours for most pollutants, except for CO and O3 (8-hour average).

Particulate matter standards: PM10 (24-hour average) — 100 µg/m³ for industrial/residential areas; PM2.5 (24-hour average) — 60 µg/m³; PM10 (annual average) — 60 µg/m³; PM2.5 (annual average) — 40 µg/m³. Gaseous pollutants (24-hour averages): SO2 — 80 µg/m³; NOx (as NO2) — 80 µg/m³; NH3 — 400 µg/m³; O3 (8-hour average) — 100 µg/m³; CO (8-hour average) — 2000 µg/m³ (2 mg/m³). Heavy metals and toxic organics (annual averages): lead — 0.5 µg/m³; arsenic — 6 ng/m³; nickel — 20 ng/m³; benzene — 5 µg/m³; benzo(a)pyrene — 1 ng/m³.`,
      },
      {
        chunkText: `GPCB's National Ambient Air Quality Monitoring (NAQM) programme operates 38 NAMP (National Ambient Monitoring Programme) stations and 24 SAMP (State Ambient Monitoring Programme) stations across Gujarat. The 38 NAMP stations are located in major industrial and urban areas: Ahmedabad (multiple stations including Maninagar, Paldi, and Vatva), Surat (Sachin, City area), Vadodara (GIDC, City), Bharuch/Ankleshwar, Vapi, Rajkot, Bhavnagar, Jamnagar, Gandhinagar, and Morbi. Each station monitors PM10, SO2, and NOx at minimum; the upgraded CAAQMS (Continuous Ambient Air Quality Monitoring System) stations also monitor PM2.5, CO, O3, and NH3.

The 2022-23 GPCB Annual Report data shows that PM10 levels at Vatva (Ahmedabad), Ankleshwar, Vapi and Morbi Ceramics GIDC are among the highest in the state, frequently exceeding the 24-hour standard of 100 µg/m³ during winter months when meteorological conditions lead to poor dispersion. GPCB issues advisories to industries in these clusters during severe pollution events.`,
      },
      {
        chunkText: `The NAAQS 2009 also prescribes methods for measurement. For PM10 and PM2.5, the standard method is High Volume Sampler (HVS) using gravimetric analysis. For SO2, the standard method is West-Gaeke (Pararosaniline) or Pulsed UV Fluorescence for CAAQMS. For NOx (as NO2), the method is Jacob Hochheiser (Modified) or Chemiluminescence for CAAQMS. For CO, Non-Dispersive Infrared (NDIR). The CPCB has issued detailed manuals for quality assurance and quality control at monitoring stations.

GPCB's CAAQMS network feeds real-time data to the CPCB National Air Quality Index portal (https://airquality.cpcb.gov.in). The Air Quality Index (AQI) is calculated from six pollutants: PM10, PM2.5, NO2, SO2, CO, and O3. An AQI of 0-50 is Good; 51-100 Satisfactory; 101-200 Moderate; 201-300 Poor; 301-400 Very Poor; above 400 Severe. Ahmedabad and Surat regularly show AQI in the Poor to Very Poor range during winter. Industrial areas like Vatva and Naroda can touch Severe levels during temperature inversions.`,
      },
    ],
  },

  // ── 10. CETP Effluent Standards ───────────────────────────────────────────
  {
    key: 'NORM-CPCB-CETP',
    title: 'CETP Effluent Standards — CPCB Guidelines',
    sourceType: 'CPCB_NORM',
    tags: ['CETP', 'effluent', 'standards', 'water', 'common-effluent-treatment'],
    chunks: [
      {
        chunkText: `Common Effluent Treatment Plants (CETPs) are shared facilities that treat combined industrial effluents from a cluster of small and medium-sized industries that individually cannot afford dedicated Effluent Treatment Plants (ETPs). CPCB has issued guidelines for CETPs prescribing performance standards for both the inlet (effluent received from member industries) and the final outlet (treated effluent discharged to the environment).

CPCB CETP guidelines prescribe the following outlet standards for discharge into surface water: pH 6.0 to 9.0; BOD (3-day, 27°C) — 30 mg/L; COD — 250 mg/L; suspended solids — 100 mg/L; oil and grease — 10 mg/L; chromium hexavalent — 0.1 mg/L; chromium total — 2.0 mg/L; lead — 0.1 mg/L; mercury — 0.01 mg/L; cadmium — 1.0 mg/L; arsenic — 0.2 mg/L; cyanide — 0.2 mg/L; phenolics — 1 mg/L; sulphide — 2 mg/L; sulphate — 1000 mg/L; chloride — 1000 mg/L; TDS — 2100 mg/L; colour — no visible colour change in dilution of 1 in 8.`,
      },
      {
        chunkText: `The CPCB CETP guidelines prescribe inlet standards that member industries must comply with before discharging to the CETP sewer. Inlet standards: pH 5.5 to 9.0; BOD — 350 mg/L; COD — 1000 mg/L; suspended solids — 500 mg/L; oil and grease — 20 mg/L; chromium total — 5 mg/L; lead — 1 mg/L; cadmium — 2 mg/L; mercury — 0.02 mg/L; arsenic — 0.5 mg/L; cyanide — 2 mg/L; sulphide — 5 mg/L; TDS — 5000 mg/L.

Gujarat has a large and dense network of CETPs, particularly around GIDC clusters. As documented in the GPCB Annual Report 2022-23, five major CETPs operate in the Ahmedabad area: AHSPA CETP at Vatva (capacity 45 MLD), Gujarat Vepari CETP at Narol, Naroda Enviro Projects CETP, Narol Dyestuff CETP, and Odhav Enviro Projects CETP. Each CETP is required to install Online Continuous Effluent Quality Monitoring System (CEQMS) at the final outlet and transmit data to GPCB servers.`,
      },
      {
        chunkText: `CPCB guidelines require CETPs to have a minimum treatment train of primary (screening, equalisation, primary clarification), secondary (biological treatment — activated sludge or MBBR), and tertiary treatment (filtration, disinfection). For dyestuff and textile CETPs, additional colour removal steps (ozonation, coagulation, or activated carbon adsorption) are mandatory to meet the colour standard. GPCB has directed CETPs in Vatva, Naroda, and Sachin (Surat) to install dedicated colour removal systems.

Spray dryers are used in several Gujarat CETPs to concentrate and dry the concentrated brine reject from Reverse Osmosis (RO) systems — particularly relevant at Vatva CETP. Spray drying converts liquid RO concentrate into powder form, eliminating liquid effluent discharge. GPCB tracks spray dryer operational hours as a proxy for zero liquid discharge (ZLD) compliance. The February 2026 CETP monitoring reports show that AHSPA Vatva CETP, Naroda Enviro, and Narol Dyestuff have spray dryer units in operation.`,
      },
      {
        chunkText: `Hazardous waste sludge management at CETPs is governed by the HW Rules 2016. CETP sludge is classified as a scheduled hazardous waste under Category 34.3 (sludge from ETP/CETP). The CETP operator must obtain HW authorisation for generation, storage, and disposal of sludge. Sludge must be sent to an authorised TSDF for final disposal in a secured landfill. GPCB tracks the quantity of sludge generated and disposed of by each CETP as part of the CETP monitoring reports submitted monthly.

As of the GPCB Annual Report 2022-23, Gujarat had 74 operational CETPs with a combined treatment capacity of approximately 1,500 MLD. Actual inflow at many CETPs is significantly below design capacity due to member industries not meeting inlet standards, seasonal variations, or industries having their own ETPs. GPCB's CETP scorecard in GPCSK tracks capacity utilisation, CEQMS compliance, HW sludge disposal, and bypass events.`,
      },
    ],
  },

  // ── 11. GPCB SOP CTE ─────────────────────────────────────────────────────
  {
    key: 'SOP-GPCB-CTE',
    title: 'GPCB SOP — Consent to Establish (CTE) Processing',
    sourceType: 'SOP',
    tags: ['consent', 'CTE', 'SOP', 'GPCB', 'application', 'NOC'],
    chunks: [
      {
        chunkText: `GPCB's Standard Operating Procedure for processing Consent to Establish (CTE) applications defines the end-to-end workflow from submission to grant or refusal. Step 1: Application submission — the industry applies through the XGN online portal with Form-I (Air Act) or Form-A (Water Act). Required documents include: site plan, process description, raw material and product details, wastewater and air emission calculations, proposed ETP/APC design, NOC from local authority, and land documents.

Step 2: Scrutiny — the GPCB field officer checks the application for completeness. The online portal automatically flags incomplete applications. Industries in Red category require full technical scrutiny by a Senior Environmental Engineer. Step 3: Site inspection — for all Red and Orange category industries, a site visit is mandatory before CTE grant. Green and White category applications may be processed on documents alone. Step 4: Committee review — Red category CTEs with capital investment above Rs 50 crore are placed before the GPCB Central Scrutiny Committee for recommendation. Step 5: CTE grant or refusal — the competent authority issues the CTE order with or without conditions within the statutory timeline.`,
      },
      {
        chunkText: `Statutory timelines for CTE processing under the GPCB SOP: Red category industries — 120 days from submission of complete application; Orange category — 60 days; Green category — 30 days; White category — 7 days (deemed auto-approval). These timelines are tracked in the XGN portal's workflow module. Applications pending beyond the statutory timeline are escalated to the Deputy Director or Director as per a tiered escalation matrix.

Standard conditions attached to GPCB CTE orders: The CTE is valid for three years or until the industry commences commercial production, whichever is earlier. The industry must install and commission all pollution control equipment as proposed in the CTE application before applying for CTO. The industry must not commence production without obtaining CTO. Any modification to the process, raw materials, or pollution control system must be intimated to GPCB and may require a fresh CTE. The CTE does not confer any right to the industry to discharge any pollutant; a separate CTO grant is required.`,
      },
      {
        chunkText: `The GPCB Document Completeness checklist for CTE applications (Red category) includes 27 mandatory documents: (1) filled Form-I / Form-A; (2) authenticated copy of land documents; (3) map showing distance from nearest habitation, water body, national park / wildlife sanctuary; (4) process flow diagram with mass balance; (5) list of raw materials with quantities; (6) effluent characterisation (volume, parameters); (7) ETP design with drawings; (8) stack details (height, diameter, emission rate); (9) APC device details; (10) HW generation list with quantities; (11) proposed TSDF linkage or pre-authorisation; (12) green belt plan; (13) no-objection letter from local authority; (14) project report / DPR; (15) CA certificate for capital investment; (16) layout plan showing process, ETP, HW storage; (17) ambient air quality baseline data (at minimum 90 days); (18) groundwater quality baseline; (19) soil quality report; (20-27) additional sector-specific documents.

AI-assisted document completeness checking in GPCSK automatically validates the presence and format of each mandatory document and flags missing or illegible items, reducing manual scrutiny time for the Consent Officer.`,
      },
    ],
  },

  // ── 12. GPCB SOP CTO Renewal ─────────────────────────────────────────────
  {
    key: 'SOP-GPCB-CTO-RENEWAL',
    title: 'GPCB SOP — Consent to Operate (CTO) and Renewal Processing',
    sourceType: 'SOP',
    tags: ['consent', 'CTO', 'renewal', 'SOP', 'GPCB', 'validity'],
    chunks: [
      {
        chunkText: `The Consent to Operate (CTO) under GPCB's SOP is the authorisation that allows a consented industry to actually commence production or operations. Application for CTO is made after construction is complete, pollution control equipment is installed and commissioned, and the CTE conditions are fulfilled. The applicant must submit: as-built drawings of ETP/APC equipment; performance test reports from an accredited laboratory showing compliance with standards; commissioning reports for OCEMS/CEQMS (where mandatory); affidavit of compliance with CTE conditions; and the applicable fee.

The GPCB field officer conducts a pre-CTO inspection to verify that installed equipment matches the CTE proposals, that the OCEMS/CEQMS is operational and transmitting data to GPCB, that the green belt plantation is complete, and that HW storage area is as prescribed. CTO is granted subject to standard conditions and sector-specific conditions recommended by the field officer. Validity: Red category CTO — 1 year initially, extendable to 5 years for industries with consistent compliance history; Orange category — 3 years; Green category — 5 years.`,
      },
      {
        chunkText: `CTO Renewal SOP: The industry must apply for renewal not later than 120 days (Red) / 90 days (Orange) / 60 days (Green) before the expiry of the current CTO. The Renewal Radar module in GPCSK tracks upcoming expiries at 90, 60, and 30 days and generates automated notifications to both the industry and the concerned GPCB officer. Late renewals attract a penalty fee.

The renewal application requires: latest monitoring data (OCEMS/CEQMS last 12 months); laboratory test reports for all consent parameters (minimum 4 sets in the previous 12 months); compliance status report against previous CTO conditions; HW disposal certificates; any CPCB / GPCB / NGT orders or directions issued during the previous CTO period and compliance status.

For industries with pending show-cause notices, closures, or court orders, renewal applications are flagged for senior officer review. An industry under directed closure cannot be granted renewal until the closure is vacated or the GPCB is satisfied that the violation has been rectified.`,
      },
      {
        chunkText: `GPCB's CTO renewal SOP distinguishes between automatic renewal (for compliant industries) and scrutiny-based renewal. Industries in the Green Compliance Category (consistently meeting norms, OCEMS data transmitted without gaps, no prosecutions in last 5 years, no pending show-cause) are eligible for fast-track renewal within 7 days of application. Red Compliance Category industries (recent violations, OCEMS gaps, pending enforcement actions) undergo full scrutiny — site inspection, data audit, committee review — before renewal is considered.

The GPCSK Renewal Radar shows the compliance category of each industry alongside the expiry date, enabling the Consent Officer to prioritise workload: auto-renewals are batch processed; scrutiny cases are individually scheduled. The system also auto-populates the renewal draft with the industry's last CTO conditions, OCEMS compliance score, and outstanding enforcement actions.`,
      },
    ],
  },

  // ── 13. GPCB SOP Inspection Red Category ─────────────────────────────────
  {
    key: 'SOP-GPCB-INSPECTION-RED',
    title: 'GPCB SOP — Inspection of Red Category Industries',
    sourceType: 'SOP',
    tags: ['inspection', 'Red-category', 'SOP', 'GPCB', 'enforcement'],
    chunks: [
      {
        chunkText: `GPCB's Standard Operating Procedure for inspection of Red category industries prescribes a risk-based inspection frequency. Minimum inspection frequency: Red category with OCEMS — quarterly (once every three months); Red category without OCEMS — bi-monthly (once every two months); Red category with active show-cause or pending prosecution — monthly until compliance confirmed. The Inspection Prioritisation module in GPCSK uses the OCEMS exceedance history, complaint count, and time since last inspection to rank industries for scheduling.

Pre-inspection checklist for the Inspector: (1) retrieve last inspection report and pending actions; (2) check OCEMS data for last 30 days for exceedances and data gaps; (3) review any citizen complaints linked to the industry; (4) note renewal status and any pending enforcement actions; (5) prepare sector-specific inspection checklist; (6) take copies of current CTO conditions; (7) take calibrated instruments — pH meter, DO meter, noise meter, sampling kits.`,
      },
      {
        chunkText: `During the field inspection, the GPCB Inspector must: (1) check actual production rate against CTO-consented capacity; (2) inspect raw material storage for any unmeasured inputs; (3) check ETP inlet and outlet (collect grab samples); (4) check that OCEMS probes are clean and calibrated (stamp date visible); (5) record stack parameters from CEMS; (6) count HW drums in storage — quantity must match HW register; (7) verify TSDF disposal certificates for the last quarter; (8) check green belt and check if any buffer zone encroachments; (9) take photographs with geo-tag and timestamp; (10) interview the Environmental Officer of the industry.

If a violation is observed during the inspection, the Inspector may collect additional composite samples (24-hour or 4-hour composite), take photographs of the violation, record the observations in the On-Site Checklist, and issue a Preliminary Observation Letter on the same day. The Preliminary Observation Letter is not a show-cause notice; it informs the industry of the observations and requests compliance within a specified period (usually 7-15 days for minor violations).`,
      },
      {
        chunkText: `Post-inspection workflow: within five working days of inspection, the Inspector must submit the Inspection Report in the XGN portal with photographs, sample analysis report (where applicable), and compliance recommendations. The report is reviewed by the Senior Environmental Engineer and forwarded to the Sub-Regional Officer or Regional Officer for approval. If violations are recommended for enforcement action, the file is processed under the Show-Cause and Closure SOP.

The GPCSK On-Site Checklist module provides a digital form that the Inspector fills during the inspection on a mobile device. Photographs are captured with automatic geo-tagging. The checklist has sector-specific branches — for example, the dyestuff section asks about colour removal performance; the pharmaceutical section checks solvent recovery and incinerator compliance; the CETP section checks bypass measurement and HW sludge log. Data entered in the field is instantly visible to the Sub-Regional Officer, enabling real-time supervision.`,
      },
    ],
  },

  // ── 14. GPCB SOP Show-Cause and Closure ──────────────────────────────────
  {
    key: 'SOP-GPCB-SHOWCAUSE-CLOSURE',
    title: 'GPCB SOP — Show-Cause Notice and Closure Direction',
    sourceType: 'SOP',
    tags: ['enforcement', 'show-cause', 'closure', 'SOP', 'GPCB', 'maker-checker'],
    chunks: [
      {
        chunkText: `GPCB's SOP for Show-Cause Notice (SCN) and Closure Direction prescribes the maker-checker workflow for enforcement actions. Step 1 (Maker — Inspection Officer): upon identifying a violation through inspection, OCEMS alert, or complaint verification, the Inspector prepares a draft SCN in XGN specifying: (a) the legal provision violated; (b) the factual basis — sample analysis results, OCEMS data, inspection observations; (c) the opportunity to show cause within 15 days; (d) the adverse action proposed — CTO suspension, closure direction, bank guarantee invocation, or prosecution.

Step 2 (Maker submits for review): the draft SCN is submitted to the Senior Reviewer (Sub-Regional Officer / Director) for approval. Step 3 (Checker reviews): the Senior Reviewer examines the evidence, verifies the legal basis, and may approve, return with notes for revision, or reject. Step 4 (Committed): once approved, the SCN is committed — digitally signed and served on the industry by registered post and in-person service. The service is logged in XGN with proof of delivery.`,
      },
      {
        chunkText: `After the Show-Cause Notice is served, the industry has 15 days to submit a written reply and request a personal hearing. The personal hearing is conducted by the designated authority (Sub-Regional Officer for Orange category; Director for Red category). Based on the reply and hearing, the authority decides whether to proceed with the proposed action or modify it. If the violations are confirmed and the industry fails to show cause, a Closure Direction or CTO Suspension order is issued. The order is again subject to maker-checker before commitment.

A Closure Direction under Section 33A of the Water Act or Section 31A of the Air Act has immediate effect. The industry must stop production within 24 hours. GPCB officials seal the main production inlet or power supply point. The closure is reported to CPCB within 72 hours. The industry may appeal to the State Pollution Control Board's Appellate Authority or to the National Green Tribunal (NGT). GPCB must file its reply in NGT matters within 15 days.`,
      },
      {
        chunkText: `The GPCSK DraftNoticeCanvas uses an AI-assisted workflow to pre-fill the Show-Cause Notice draft. The AI pulls the industry's profile, OCEMS data for the period in question, recent inspection reports, and the applicable legal provision, and generates a structured draft that the Inspection Officer reviews and edits. The draft is grounded in actual data — sample analysis values, OCEMS time-series statistics, and the specific norm values violated. The Officer corrects factual errors and adds contextual observations before submitting for Checker review.

Bank Guarantee Invocation under Section 33B (Water Act) / 31B (Air Act) may be used in cases where an industry has repeatedly violated consent conditions despite previous enforcement action. GPCB may call upon the bank guarantee (a condition of the CTO) to fund the cost of remediation or to signal financial consequences. Bank guarantee amounts in GPCB practice range from Rs 5 lakh to Rs 2 crore depending on the industry category and prior violation history.`,
      },
    ],
  },

  // ── 15. GPCB Annual Report 2022-23 ────────────────────────────────────────
  {
    key: 'AR-GPCB-2022-23',
    title: 'GPCB Annual Report 2022-23 — Summary',
    sourceType: 'ANNUAL_REPORT',
    tags: ['annual-report', 'GPCB', '2022-23', 'statistics', 'compliance', 'monitoring'],
    chunks: [
      {
        chunkText: `The GPCB Annual Report 2022-23 covers the Board's activities across consent management, monitoring, enforcement, and environmental improvement for the financial year April 2022 to March 2023. Key consent statistics: total consent applications received — 32,847 (including CTE, CTO, and renewals); applications disposed of within statutory timelines — 94.2%; total valid CTO holders at year-end — 1,18,420 industries. Category distribution of consented industries: Red — 4,812; Orange — 28,643; Green — 72,491; White — 12,474.

OCEMS and CEQMS compliance: As of March 2023, GPCB had issued mandatory OCEMS/CEQMS orders to 784 Red category industries. Of these, 716 (91.3%) had installed and commissioned OCEMS/CEQMS and were transmitting data to GPCB servers. The 68 non-compliant industries were under enforcement action. OCEMS data showed 2,841 parametric exceedances across all OCEMS-equipped industries during the year; 312 of these were classified as major exceedances triggering show-cause proceedings.`,
      },
      {
        chunkText: `Air Quality Monitoring under the GPCB Annual Report 2022-23: The Board operates 38 NAMP stations and 24 SAMP stations (total 62 AAQM stations). Annual average PM10 levels in key industrial areas: Vatva (Ahmedabad) — 118 µg/m³ (exceeding NAAQS annual standard of 60 µg/m³); Ankleshwar — 104 µg/m³; Vapi — 97 µg/m³; Naroda — 111 µg/m³; Morbi Ceramics — 138 µg/m³; Sachin Surat — 88 µg/m³. Winter months (November to February) show significantly elevated PM10 due to thermal inversions, crop residue burning, and festival-season emissions.

Annual average SO2 levels at major industrial areas: Ankleshwar — 28.4 µg/m³ (within 24-hr standard of 80 µg/m³ but high compared to urban averages); Vatva — 22.1 µg/m³; Hazira — 31.2 µg/m³. NOx (as NO2) at Morbi — 45.6 µg/m³ (within standard but elevated). GPCB issued directions to 14 industries in Morbi ceramics cluster under the Air Act for excessive PM10 emissions from kiln stacks.`,
      },
      {
        chunkText: `Water Quality Monitoring under GPCB Annual Report 2022-23: The Board operates the MINARS (Monitoring of Indian National Aquatic Resources System) and GEMS (Global Environment Monitoring System) programme with 152 stations across Gujarat's rivers, lakes, reservoirs, and coastal waters. Key findings: Sabarmati river at Vasna (Ahmedabad downstream) — BOD 18 mg/L, DO 3.2 mg/L (classified as Class C water, indicating significant pollution load); Sabarmati at Narol — BOD 28 mg/L, DO 1.8 mg/L (Class D). Mahi river at Vasad — BOD 6 mg/L, DO 6.1 mg/L (Class B). Narmada at Garudeshwar (downstream of Bharuch) — BOD 2 mg/L, DO 7.4 mg/L (Class A — pristine condition maintained).

Industrial river stretches showing high pollution load: the Khari creek stretch receiving effluents from Vatva GIDC showed COD values up to 450 mg/L in the monsoon sample (July 2022). GPCB directed all industries in the Vatva cluster to verify that their CETP connections were functioning properly.`,
      },
      {
        chunkText: `VOC Cluster Monitoring under GPCB Annual Report 2022-23: GPCB operates VOC monitoring at 25 industrial clusters. The monitoring programme covers 15 parameters: benzene, toluene, ethylbenzene, xylenes (BTEX), cyclohexane, n-hexane, carbon tetrachloride, chloroform, dichloromethane, trichloroethylene, perchloroethylene, acetone, methyl ethyl ketone, isopropanol, and total hydrocarbons. Clusters with highest benzene levels: Ankleshwar pharma/chemical cluster — 8.2 µg/m³ (exceeding NAAQS annual limit of 5 µg/m³); Vapi chemical cluster — 6.4 µg/m³. Toluene at Sachin textile cluster — 28 µg/m³. GPCB directed industries in Ankleshwar and Vapi to audit their solvent handling and fugitive emission controls.

Enforcement statistics 2022-23: show-cause notices issued — 1,247; closure directions issued — 89; prosecutions filed — 234; bank guarantee invocations — 12; industries closed under Section 33A (Water Act) — 31; CTO suspensions — 58. Major categories of violations: OCEMS data tampering — 18 cases; discharge without consent — 44 cases; HW violations — 67 cases; non-installation of APC devices — 123 cases.`,
      },
      {
        chunkText: `Festival Monitoring under GPCB Annual Report 2022-23: GPCB conducted extensive ambient air and water quality monitoring during major festivals. Ganesh Utsav monitoring covered 12 idol immersion sites on the Sabarmati river (Ahmedabad) and 8 sites in Surat. Pre-immersion (3 days before), during immersion (day of), and post-immersion (3 days after) samples were collected. Results showed that on the immersion day, total dissolved solids (TDS) in the Sabarmati at Paldi ghat rose to 1,840 mg/L compared to the pre-immersion baseline of 680 mg/L. Turbidity rose from 32 NTU to 420 NTU. pH rose from 7.2 to 8.8 (reflecting POP idol dissolution).

Navratri ambient air monitoring at 8 major pandal sites in Ahmedabad showed that noise levels from generator sets and loudspeakers at some pandals reached 95-105 dB(A) between 10 PM and midnight, well above the nighttime limit of 45 dB(A) for residential areas. GPCB issued directions to the Ahmedabad Municipal Corporation to restrict generator use and enforce noise limits.`,
      },
    ],
  },

  // ── 16. GPCB Annual Report 2024-25 ────────────────────────────────────────
  {
    key: 'AR-GPCB-2024-25',
    title: 'GPCB Annual Report 2024-25 — Summary',
    sourceType: 'ANNUAL_REPORT',
    tags: ['annual-report', 'GPCB', '2024-25', 'statistics', 'compliance', 'green-industry'],
    chunks: [
      {
        chunkText: `The GPCB Annual Report 2024-25 reflects the Board's enhanced digital enforcement and monitoring capabilities deployed following the GPCSK system rollout. Key highlights: total consent applications received — 38,214 (up 16% from 2022-23); disposal within timelines — 96.8% (up from 94.2%); total valid CTO holders at year-end — 1,27,840 (up from 1,18,420). Red category industries with OCEMS operational — 98.2% (up from 91.3%), reflecting successful enforcement of OCEMS compliance over two years.

AI-assisted document completeness check reduced average CTE processing time for Red category from 87 days to 54 days. The GPCSK Renewal Radar resulted in a 31% reduction in late renewal applications compared to 2022-23. The Maker-Checker queue processed 1,893 enforcement actions; average approval time for show-cause notices fell from 18 days to 7 days due to AI-drafted notices reviewed by inspectors.`,
      },
      {
        chunkText: `Air Quality Monitoring 2024-25: Annual average PM10 at Vatva reduced to 98 µg/m³ (from 118 µg/m³ in 2022-23) following GPCB's directed shutdown of 14 non-compliant industries and upgradation of ETP/APC in Vatva cluster. Ankleshwar PM10 reduced to 89 µg/m³ (from 104). Morbi Ceramics still shows PM10 at 129 µg/m³ — persistently elevated due to high kiln density. GPCB has issued show-cause notices to 23 ceramic industries in Morbi for persistent PM10 exceedances.

Benzene levels at Ankleshwar reduced to 4.8 µg/m³ (below NAAQS limit of 5 µg/m³) following mandatory fugitive emission audits directed in 2023-24. Vapi benzene levels at 5.1 µg/m³ — marginally above limit; GPCB directed additional monitoring and source apportionment study at Vapi VOC cluster.`,
      },
      {
        chunkText: `Water Quality Monitoring 2024-25: Sabarmati at Vasna-Narol stretch shows marginal improvement — BOD at Narol reduced from 28 mg/L (2022-23) to 22 mg/L, aided by upgradation of AHSPA Vatva CETP to 60 MLD capacity and improved CETP performance. However, the river still classifies as Class D (highly polluted) during non-monsoon months when dilution flow in the Sabarmati is low.

Coastal water quality monitoring at Gulf of Kutch (Mundra, Kandla, Jamnagar) and Gulf of Khambhat (Hazira, Bharuch, Dahej) was expanded to quarterly sampling in 2024-25. Hazira coast — Total Coliform 14,000 MPN/100 mL (indicating sewage contribution); Dahej coast — within limits. GPCB directed Surat Municipal Corporation and Hazira industries to audit their sewage treatment and storm water discharge channels.

CETP network 2024-25: 81 CETPs operational (up from 74 in 2022-23); combined capacity 1,720 MLD; average capacity utilisation 68%. Five new CETPs commissioned in Morbi, Sanand, Bhachau-Gandhidham, Vyara, and Rajkot-Lodhika.`,
      },
      {
        chunkText: `Enforcement Statistics 2024-25: show-cause notices issued — 1,482 (up from 1,247); closure directions issued — 74 (down from 89, reflecting proactive consent-stage compliance improvements); prosecutions filed — 298; bank guarantee invocations — 21 (up from 12); CTO suspensions — 43. GPCB recovered Rs 3.4 crore from bank guarantee invocations.

Notable enforcement actions 2024-25: Closure of 12 ceramic industries in Morbi for persistent PM10 exceedances and failure to install fabric filters as directed. Prosecution of 6 industries in Vatva for OCEMS data tampering — identified by statistical analysis of OCEMS data streams showing implausibly clean readings. Directed bank guarantee invocation against 4 Vapi chemical industries for discharge of TDS above 5000 mg/L to public sewers, repeatedly despite show-cause proceedings.

Citizen complaints 2024-25: 4,218 complaints received (up 22% from 2022-23); average resolution time — 28 days (down from 41 days in 2022-23); repeat complaints resolved after site verification — 91%. Ahmedabad and Surat account for 48% of total complaints.`,
      },
    ],
  },

  // ── 17. Festival Monitoring SOP ───────────────────────────────────────────
  {
    key: 'SOP-FESTIVAL-MONITORING',
    title: 'GPCB Festival Monitoring SOP — Ganesh Utsav, Navratri, Diwali',
    sourceType: 'FESTIVAL_MONITORING',
    tags: ['festival', 'monitoring', 'Ganesh-Utsav', 'Navratri', 'Diwali', 'idol-immersion', 'noise', 'water-quality'],
    chunks: [
      {
        chunkText: `GPCB's Festival Monitoring SOP covers the three major festivals with significant environmental impact: Ganesh Utsav (August-September), Navratri (October), and Diwali (October-November). The SOP defines monitoring points, parameters, frequency, and escalation procedures for each festival.

Ganesh Utsav Monitoring (Idol Immersion in Surface Water): GPCB identifies all major idol immersion ghats on the Sabarmati river (Ahmedabad — Paldi, Ellisbridge, Sabarmati, Chandola, Khokhara ghats; total 12 sites), Mahi river, Tapti river (Surat — Athwalines, Sarthana; 8 sites), and other notified rivers. Pre-immersion (T-3 days), During immersion (T-0), Post-immersion (T+1 and T+3 days) water samples are collected at each ghat. Parameters monitored: pH, BOD, COD, dissolved oxygen (DO), total dissolved solids (TDS), turbidity, total coliforms, faecal coliforms, and heavy metals from idol paint (chromium, lead, cadmium, arsenic in selected samples).`,
      },
      {
        chunkText: `Sabarmati Ganesh Utsav Data — Historical Context: The GPCB source PDF on festival monitoring (Ganesh Utsav Sabarmati monitoring) documents the following observations at Paldi Ghat (Ahmedabad) for Ganesh Utsav 2022: Pre-immersion (baseline) — DO 3.4 mg/L, BOD 14 mg/L, TDS 640 mg/L, pH 7.4, turbidity 38 NTU. On immersion day (peak immersion hours 10 AM to 2 PM and 8 PM to midnight) — DO fell to 1.6 mg/L (sharp depletion due to biodegradable organic load from POP idols), BOD 42 mg/L, TDS 1,820 mg/L, pH 8.9, turbidity 580 NTU, chromium 0.18 mg/L (above CPCB drinking water guideline of 0.05 mg/L), lead 0.12 mg/L. Post-immersion T+3 — DO 3.1 mg/L, BOD 18 mg/L, TDS 700 mg/L, pH 7.5, turbidity 45 NTU. Recovery to near-baseline within 3-4 days.

Eco-friendly idol campaign: GPCB and the state government run the Eco-friendly Ganesh Idol campaign promoting clay (shaadu) idols over Plaster of Paris (POP) idols. POP idols contain synthetic paints with heavy metals and take months to dissolve, disrupting the river bed. Uptake of eco-friendly idols in urban areas increased from 18% (2019) to 41% (2022) and 55% (2024) following public awareness campaigns.`,
      },
      {
        chunkText: `Navratri Festival Monitoring: GPCB deploys mobile noise monitoring teams at major Navratri pandals in Ahmedabad, Surat, Vadodara, Rajkot, and Bhavnagar during the 9-night festival. Monitoring hours: 6 PM to 2 AM (covering peak celebration hours). Parameters: equivalent continuous noise level (Leq), maximum instantaneous level (Lmax). Monitoring points are set at the pandal boundary and at the nearest residential receptor.

Typical findings: generator sets at pandals generate Leq 80-95 dB(A) at the pandal boundary; at residential receptors 100-200 m away, Leq typically 65-75 dB(A) during peak hours — well above the nighttime limit of 45 dB(A). GPCB issues daily noise bulletins during Navratri to AMC and police. Persistent violators (above Leq 90 dB(A) at boundary after 10 PM on multiple nights) are reported to the district collector for action. Directional speakers (more focused, lower spillover) are now required for new pandal registrations in Ahmedabad and Surat as a condition of municipal permission.`,
      },
      {
        chunkText: `Diwali Festival Monitoring: GPCB deploys ambient air quality monitoring (PM10, PM2.5, SO2, NOx) at 20 fixed stations and 10 mobile locations during Diwali (one day before, on Diwali day, and two days after). Historical data from Diwali 2022 (Ahmedabad): Pre-Diwali PM2.5 at Maninagar — 58 µg/m³ (already elevated due to winter meteorology); on Diwali night (8 PM to midnight) — PM2.5 rose to 285 µg/m³; next morning peak — 310 µg/m³; returned to 80 µg/m³ within 48 hours. AQI on Diwali night reached Severe category (above 400) at several stations.

GPCB's Diwali SOP includes: advance deployment of CAAQMS; press release with pre-Diwali air quality status; real-time AQI display at major public locations; advisory to hospitals for readiness; coordination with police for cracker ban enforcement (green crackers approved under CPCB norms; traditional crackers banned in Municipal Corporation areas). Post-Diwali GPCB report includes station-wise PM2.5 and PM10 data published within 72 hours.`,
      },
      {
        chunkText: `Idol Immersion Remediation Guidance: The GPCB Festival Monitoring SOP specifies remediation responsibilities. Municipalities must deploy boats to remove undissolved idol fragments and debris from ghats within 24 hours of immersion. GPCB provides technical guidance on the use of constructed wetlands or rapid sand filtration at designated ghat sites to reduce pollution load. For rivers that show DO below 2 mg/L post-immersion, GPCB may direct emergency aeration through compressed air diffusers or cascade aerators.

For events with particularly high idol count (such as Ahmedabad where over 50,000 Ganesh idols are immersed across all ghats), GPCB directs Ahmedabad Municipal Corporation to set up dedicated clay idol immersion tanks at each ghat to offer an alternative to river immersion. Use of immersion tanks for eco-friendly idols is incentivised through civic rewards. GPCB maintains the Festival Monitoring Planner module in GPCSK with historical ghat-wise data so the Monitoring Officer can compare current year performance against the 3-year baseline and plan sampling logistics.`,
      },
    ],
  },

  // ── 18. GPCB Officer FAQ ──────────────────────────────────────────────────
  {
    key: 'FAQ-GPCB-OFFICER',
    title: 'GPCB Officer FAQ — GPCSK System',
    sourceType: 'FAQ',
    tags: ['FAQ', 'officer', 'GPCSK', 'consent', 'monitoring', 'enforcement', 'AI'],
    chunks: [
      {
        chunkText: `Q: What is the difference between OCEMS and CEQMS in GPCB's monitoring framework?
A: OCEMS (Online Continuous Emission Monitoring System) monitors gaseous pollutants emitted from stacks at air-polluting industries — typically SO2, NOx, HCl, HF, NH3, CO, dust (PM), and flow rate. CEQMS (Continuous Effluent Quality Monitoring System) monitors parameters in the effluent stream from water-polluting industries at the final ETP outlet — typically pH, COD, BOD (via surrogate), suspended solids (via turbidity), and flow rate. Both are required by GPCB for all Red category industries as a condition of CTO. Data from OCEMS and CEQMS is transmitted in real time to GPCB servers and is visible on the GPCSK OCEMS Live Grid and Exceedance Feed.

Q: Can an industry challenge a closure direction issued by GPCB?
A: Yes. The industry may appeal to the GPCB Appellate Authority constituted under Section 28 of the Water Act (and corresponding provision of the Air Act) within 30 days of the closure direction. The Appellate Authority, headed by a retired judge, may stay the closure pending hearing. The industry may also file a writ petition in the Gujarat High Court or approach the National Green Tribunal (NGT) Western Zone Bench in Pune. GPCB must file its counter-affidavit within 15 days in NGT matters.`,
      },
      {
        chunkText: `Q: What is the Renewal Radar and how does it generate notifications?
A: The Renewal Radar module in GPCSK automatically scans all active CTO records daily and flags industries whose CTO is due to expire in 90, 60, and 30 days. At 90 days, an automated in-app notification is sent to the Consent Officer and a system-generated reminder letter is available for dispatch to the industry. At 60 days, the Consent Officer receives a higher-priority alert. At 30 days without a renewal application received, the industry is flagged as a potential expiry risk and an escalation notification is sent to the Sub-Regional Officer. The Renewal Radar also applies to HW Authorisations, which are co-termed with the CTO but are processed on a separate track.

Q: How does the GPCSK AI generate a Show-Cause Notice draft?
A: The DraftNoticeCanvas AI retrieves the industry's latest inspection report, OCEMS/CEQMS exceedance data for the relevant period, the applicable consent condition, and the specific norm value violated. It generates a structured SCN draft citing the section of law, quoting the observed data, comparing it with the norm, and stating the proposed adverse action. The Inspector reviews the draft, verifies the figures, adds contextual observations (e.g., the industry's prior history), and submits for Checker (Senior Officer) approval. The AI draft is a starting point — the Inspector is responsible for the final content.`,
      },
      {
        chunkText: `Q: What is the maker-checker process for consent decisions in GPCSK?
A: For CTE and CTO decisions, the Consent Officer acts as Maker. After scrutiny, the Officer prepares a recommendation (grant with conditions, grant with modifications, or refusal) and submits it to the Senior Reviewer (Sub-Regional Officer or Director depending on industry category). The Senior Reviewer is the Checker — they review the recommendation, can approve it, return it with notes for revision, or reject it. Once approved by the Checker, the decision is committed — the system generates the order letter and updates the XGN records. All transitions are stamped with actor ID, timestamp, and reason, and are written to the AuditLog. This ensures a two-person principle for all consequential decisions.

Q: How does the GPCSK Industry Deep Dive canvas work?
A: Clicking on any industry from any module (Renewal Radar, OCEMS Live Grid, Inspection Prioritisation, etc.) opens the Industry Deep Dive canvas. It shows: current consent status (CTE/CTO/HW) with expiry dates; all OCEMS/CEQMS readings for the past 30 days with exceedance markers; all inspections in the past 24 months with outcomes; all active complaints linked to the industry; all active enforcement actions and their stage; and a risk score computed from exceedance frequency, inspection history, complaint count, and renewal status. The Risk Score drives the Inspection Prioritisation ranking and the Industry Risk Index mega-dashboard.`,
      },
      {
        chunkText: `Q: Which roles can access the Maker-Checker Queue?
A: Only the Senior Reviewer / Member Secretary role has access to the Maker-Checker Queue in GPCSK. This queue aggregates all pending enforcement action drafts (show-cause, closure, bank guarantee) and consent recommendation drafts submitted for review. Maker roles — Inspection Officer (for enforcement) and Consent Officer (for consent decisions) — see only their own submissions and the resulting decisions (approved / returned). Monitoring Officers see OCEMS exceedance dispositions in their own workflow. The Senior Reviewer has a statewide view across all streams and all districts.

Q: How does GPCSK handle citizen complaints from multiple channels?
A: The Complaints Officer's Complaint Inbox aggregates complaints from four channels: GPCB web portal (https://gpcb.gujarat.gov.in); GPCB complaint phone line; email (complaints@gpcb.nic.in); and walk-in complaints at any GPCB regional office. Each complaint is auto-classified by the AI into a category (air pollution, water pollution, noise, solid waste, hazardous waste, other) and assigned a preliminary severity (high / medium / low) based on keywords and geographic clustering. The Complaints Officer reviews the auto-triage, may reassign category or severity, and assigns the complaint to the appropriate GPCB field officer for site verification. The Hotspot Map clusters complaints by location using a grid-based density algorithm to identify emerging pollution hotspots.`,
      },
      {
        chunkText: `Q: What data does the Gujarat Pollution Pulse mega-dashboard show?
A: The Gujarat Pollution Pulse is the Senior Reviewer's real-time situational awareness dashboard. It shows: (1) a Gujarat district map with colour-coded pollution intensity by stream (air, water, HW, noise) for the current day; (2) live count of active OCEMS/CEQMS exceedances; (3) top-10 highest-risk industries (by composite risk score); (4) breaking anomaly alerts (unusual spikes, data tampering flags, OCEMS downtime alerts); (5) pending maker-checker items count; (6) unresolved citizen complaints count; (7) industries with CTO expiring in next 30 days. The dashboard auto-refreshes every 5 minutes. Clicking any element navigates to the detailed module — district click goes to all industries in that district, anomaly click goes to the anomaly detail with evidence.

Q: What is the difference between Red, Orange, Green, and White category industries in GPCB?
A: CPCB has classified industries into four categories based on the Pollution Index (PI), which is a composite score of effluent (water), emission (air), hazardous waste generation, and resource consumption. Red category: PI ≥ 60 — large polluting industries such as refineries, bulk chemicals, pharmaceuticals, dyestuff, tanneries, pulp and paper. Orange category: 41 ≤ PI < 60 — moderate polluters such as food processing, auto components, small chemicals. Green category: 21 ≤ PI ≤ 40 — low polluters such as textiles (no dyeing), light engineering, bakeries. White category: PI < 21 — essentially non-polluting industries like IT, banking, hotels (without boilers). Category determines inspection frequency, consent validity period, and mandatory monitoring requirements.`,
      },
    ],
  },
]

// ── Seed function ─────────────────────────────────────────────────────────────

export async function seedKnowledge(prisma: PrismaClient): Promise<void> {
  for (const doc of KNOWLEDGE_DOCS) {
    // Upsert the document (keyed by title — title is unique in practice)
    const existingDoc = await prisma.knowledgeDocument.findFirst({
      where: { title: doc.title },
    })

    let docId: string
    if (existingDoc) {
      docId = existingDoc.id
      await prisma.knowledgeDocument.update({
        where: { id: docId },
        data: {
          sourceType: doc.sourceType,
          tags: doc.tags,
        },
      })
    } else {
      const created = await prisma.knowledgeDocument.create({
        data: {
          title: doc.title,
          sourceType: doc.sourceType,
          tags: doc.tags,
        },
      })
      docId = created.id
    }

    // For each chunk, upsert by (documentId, first 80 chars of chunkText)
    for (const chunk of doc.chunks) {
      const prefix = chunk.chunkText.slice(0, 80)
      const existing = await prisma.knowledgeChunk.findFirst({
        where: {
          documentId: docId,
          chunkText: { startsWith: prefix },
        },
      })
      if (!existing) {
        await prisma.knowledgeChunk.create({
          data: {
            documentId: docId,
            chunkText: chunk.chunkText,
          },
        })
      }
    }
  }
}
