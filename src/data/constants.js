import {
  Ban,
  BarChart3,
  CircleDollarSign,
  Droplet,
  Eye,
  Headphones,
  Image as ImageIcon,
  Layers,
  Link2,
  MessageSquareQuote,
  Ruler,
  Scissors,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react'

export const BASE_PATH = import.meta.env.BASE_URL
export const DATA_PATH = `${BASE_PATH}data/`
export const DASHBOARD_DATA_PATH = `${DATA_PATH}dashboard_data/`
export const LOGO_PATH = `${BASE_PATH}lululemon-logo.png`
export const ALL_FILTER_VALUE = 'All'
export const LOW_STAR_RATINGS = [1, 2, 3]
export const HIDDEN_PRODUCT_IDS = ['pace_breaker_short_7_linerless']
export const DEFAULT_REGION = 'north_america'
export const REGION_OPTIONS = [
  { value: 'north_america', label: 'North America' },
  { value: 'asia', label: 'Asia' },
  { value: 'australia', label: 'Australia' },
  { value: 'new_zealand', label: 'New Zealand' },
]
export const DEFAULT_TIME_PERIOD = '6M'
export const TIME_PERIOD_OPTIONS = [
  { value: 'ALL', label: 'All', months: 1200 },
  { value: '12M', label: '12M', months: 12 },
  { value: '6M', label: '6M', months: 6 },
  { value: '3M', label: '3M', months: 3 },
  { value: '1M', label: '1M', months: 1 },
]

export const severityPalette = {
  1: '#E20010',
  2: '#737373',
  3: '#d4d4d4',
}

export const themePalette = [
  '#E20010',
  '#1a1a1a',
  '#404040',
  '#595959',
  '#737373',
  '#8c8c8c',
  '#a6a6a6',
  '#bfbfbf',
  '#d9d9d9',
]

export const trendPalette = {
  positive: '#1f6f3e',
  negative: '#E20010',
  neutral: '#9a9a9a',
}

export const navRoutes = [
  { label: 'Insights', to: '/insights' },
  { label: 'Analytics', to: '/analytics' },
  { label: 'Reviews', to: '/reviews' },
  { label: 'Gallery', to: '/gallery' },
]

export const themeKeywordMap = {
  'Fabric & Material Quality': [
    'pill',
    'pilling',
    'fabric',
    'material',
    'quality',
    'thin',
    'texture',
    'durable',
    'durability',
    'worn',
    'wear',
    'soft',
    'cheap',
    'nulu',
  ],
  'Shipping & Delivery': [
    'shipping',
    'delivery',
    'arrived',
    'package',
    'packaging',
    'delayed',
    'delay',
    'tracking',
    'missing package',
    'courier',
    'express',
  ],
  'Customer Service': [
    'customer service',
    'service',
    'refund',
    'return',
    'support',
    'manager',
    'policy',
    'resolved',
    'resolution',
    'store',
    'response',
  ],
  'Sizing & Fit': [
    'size',
    'sizing',
    'fit',
    'tight',
    'small',
    'large',
    'xl',
    'xs',
    'shoulder',
    'arm',
    'arms',
    'waist',
    'runs small',
    'runs large',
  ],
  'Color & Product Description': [
    'color',
    'colour',
    'pictured',
    'picture',
    'photo',
    'image',
    'description',
    'described',
    'pink',
    'purple',
    'lilac',
    'mauve',
  ],
  'Pricing & Value': [
    'price',
    'priced',
    'expensive',
    'overpriced',
    'worth',
    'value',
    'money',
    '$',
  ],
  'Zipper Issues': ['zipper', 'zip', 'zippers'],
  'Stitching & Construction': [
    'stitch',
    'stitching',
    'seam',
    'seams',
    'thread',
    'construction',
    'fray',
    'fraying',
    'hole',
  ],
  'Product Cleanliness': [
    'stain',
    'stains',
    'dirty',
    'filthy',
    'smell',
    'odor',
    'clean',
    'water stain',
  ],
  'Design & Features': [
    'design',
    'feature',
    'features',
    'thumb hole',
    'cuffin',
    'alteration',
    'shorten',
    'sleeve',
    'sleeves',
    'pocket',
    'version',
  ],
}

export const themeDetailCopy = {
  'Fabric & Material Quality': {
    action: 'Re-test durability standards, pilling resistance, and premium fabric finish consistency.',
  },
  'Shipping & Delivery': {
    action: 'Tighten fulfillment QA and last-mile issue resolution to reduce preventable delivery friction.',
  },
  'Customer Service': {
    action: 'Improve recovery playbooks for returns, refunds, and store-level escalation handling.',
  },
  'Sizing & Fit': {
    action: 'Sharpen size guidance, fit notes, and comparison cues for customers sizing across silhouettes.',
  },
  'Color & Product Description': {
    action: 'Improve PDP imagery and color accuracy so online expectations match delivered product reality.',
  },
  'Pricing & Value': {
    action: 'Strengthen the premium value proposition with clearer quality proof points.',
  },
  'Zipper Issues': {
    action: 'Review zipper supplier quality, stress points, and repeat-use testing standards.',
  },
  'Stitching & Construction': {
    action: 'Audit seam integrity and finishing quality against premium craftsmanship expectations.',
  },
  'Product Cleanliness': {
    action: 'Add stricter final inspection before packing and shipment handoff.',
  },
  'Design & Features': {
    action: 'Review which design changes or missing features are creating expectation gaps for loyal buyers.',
  },
}

export const defectCategoryMap = {
  'Stitching & Construction': {
    label: 'Stitching / Sewing',
    issueLabel: 'Stitching seam opening',
    operationArea: 'Sewing Line',
    recommendedAction: 'Review seam allowance and sewing method.',
    owner: 'Production Engineering',
    operationRelated: true,
  },
  'Zipper Issues': {
    label: 'Zipper',
    issueLabel: 'Zipper failure',
    operationArea: 'Attachment Operation',
    recommendedAction: 'Check zipper attachment and puller quality.',
    owner: 'QA + Supplier',
    operationRelated: true,
  },
  'Fabric & Material Quality': {
    label: 'Fabric Quality',
    issueLabel: 'Fabric pilling',
    operationArea: 'Fabric Handling / Material',
    recommendedAction: 'Review fabric inspection and handling.',
    owner: 'Development',
    operationRelated: true,
  },
  'Color & Product Description': {
    label: 'Color Fading',
    issueLabel: 'Color fading after wash',
    operationArea: 'Dye / Wash / Material',
    recommendedAction: 'Check colorfastness feedback.',
    owner: 'Development',
    operationRelated: true,
  },
  'Sizing & Fit': {
    label: 'Sizing / Fit',
    issueLabel: 'Sizing inconsistency',
    operationArea: 'Pattern / Measurement',
    recommendedAction: 'Review pattern grading and size consistency.',
    owner: 'Technical Team',
    operationRelated: true,
  },
  'Customer Service': {
    label: 'Customer Service',
    issueLabel: 'Service recovery delay',
    operationArea: null,
    recommendedAction: 'Improve recovery playbooks for returns and refunds.',
    owner: 'Customer Experience',
    operationRelated: false,
  },
}

export const defaultDefectCategory = {
  label: 'Other',
  issueLabel: 'Emerging complaint pattern',
  operationArea: null,
  recommendedAction: 'Monitor for emerging complaint patterns.',
  owner: 'Quality Team',
  operationRelated: false,
}

export const officialDefectGroups = [
  {
    key: 'Cleanliness',
    label: 'Cleanliness',
    operationArea: 'Final Inspection / Packing QC',
    heatmapLabel: 'Cleanliness',
    owner: 'Final QA & Packing Team',
    preventionAction:
      'Reinforce pre-pack visual inspection for stains, odor, and surface cleanliness before folding and bagging.',
    qaChecklist: [
      'Pre-pack visual inspection',
      'Odor check',
      'Stain / spot check',
      'Packing area cleanliness audit',
    ],
    actionIssueLabel: 'Stains, dirt, or odor on finished garment',
    customerSummary: 'Stains, odor, or cleanliness concerns noticed on arrival.',
    icon: Droplet,
    isProduction: true,
    isCertified: true,
  },
  {
    key: 'Construction',
    label: 'Construction',
    operationArea: 'Sewing Line / Seam & Trim Attachment',
    heatmapLabel: 'Construction',
    owner: 'Sewing Line & Production Engineering',
    preventionAction:
      'Audit seam strength, stitch tension, SPI consistency, and zipper / trim attachment on the sewing line.',
    qaChecklist: [
      'Seam strength test',
      'Stitch tension check',
      'Zipper function test',
      'End-line inspection',
    ],
    actionIssueLabel: 'Seam, stitching, or zipper / trim defect',
    customerSummary: 'Stitching, seams, and zipper construction issues.',
    icon: Scissors,
    isProduction: true,
    isCertified: true,
  },
  {
    key: 'Embellishment',
    label: 'Embellishment',
    operationArea: 'Embellishment (Print & Embroidery)',
    heatmapLabel: 'Embellishment',
    owner: 'Embellishment Department',
    preventionAction:
      'Calibrate embroidery registration and print alignment; add an embellishment-stage QC checkpoint.',
    qaChecklist: ['Embroidery registration check', 'Print alignment audit', 'Color / thread match review'],
    actionIssueLabel: 'Embroidery or print embellishment defect',
    customerSummary: 'Print, embroidery, and decorative detail defects.',
    icon: Sparkles,
    isProduction: true,
    isCertified: true,
  },
  {
    key: 'Material',
    label: 'Material',
    operationArea: 'Fabric Inspection / Incoming Material QA',
    heatmapLabel: 'Material',
    owner: 'Fabric & Materials QA',
    preventionAction:
      'Tighten incoming fabric inspection (4-point system) and validate supplier material certificates.',
    qaChecklist: ['4-point fabric inspection', 'Pilling / abrasion test', 'Supplier material certificate audit'],
    actionIssueLabel: 'Fabric or material quality defect',
    customerSummary: 'Fabric feel, durability, and material performance concerns.',
    icon: Layers,
    isProduction: true,
    isCertified: true,
  },
  {
    key: 'Measurements',
    label: 'Measurements',
    operationArea: 'Pattern & Cutting',
    heatmapLabel: 'Measurements',
    owner: 'Pattern Engineering Team',
    preventionAction: 'Recheck pattern grading and cutting tolerances against the approved spec sheet.',
    qaChecklist: ['Pattern grading review', 'In-line measurement check', 'Size consistency audit'],
    actionIssueLabel: 'Measurement out of tolerance',
    customerSummary: 'Sizing and fit inconsistencies compared to expected garment measurements.',
    icon: Ruler,
    isProduction: true,
    isCertified: true,
  },
  {
    key: 'Trim',
    label: 'Trim',
    operationArea: 'Trim & Accessories Attachment',
    heatmapLabel: 'Trim',
    owner: 'Trim Attachment Team',
    preventionAction:
      'Verify trim component specs (labels, tape, buttons, hardware) against approved supplier samples.',
    qaChecklist: ['Trim component spec check', 'Supplier sample comparison', 'Attachment strength test'],
    actionIssueLabel: 'Trim or accessory attachment defect',
    customerSummary: 'Issues with labels, tape, buttons, and other attached components.',
    icon: Link2,
    isProduction: true,
    isCertified: true,
  },
  {
    key: 'Unclassified',
    label: 'Unclassified',
    operationArea: 'Not yet matched to an official defect code',
    heatmapLabel: 'Unclassified',
    owner: 'Needs Manual Review',
    preventionAction:
      'Manually review this complaint — no official defect code cleared the similarity threshold.',
    qaChecklist: [],
    actionIssueLabel: 'Unclassified guest complaint',
    icon: ShieldCheck,
    isProduction: true,
    isCertified: false,
  },
  {
    key: 'Non-Production',
    label: 'Non-Production',
    operationArea: 'Not factory actionable',
    heatmapLabel: 'Non-Production',
    owner: 'Non-production',
    preventionAction: 'Route to customer experience or merchandising — no factory action required.',
    qaChecklist: [],
    actionIssueLabel: 'Non-production complaint',
    icon: Ban,
    isProduction: false,
    isCertified: false,
  },
]

export const businessGroupBlueprints = [
  {
    slug: 'product-quality',
    group: 'Product Quality Issues',
    owner: 'Product',
    status: 'In Review',
    categories: [
      'Fabric & Material Quality',
      'Zipper Issues',
      'Stitching & Construction',
      'Product Cleanliness',
    ],
    businessMeaning: 'Product quality and quality-control concerns',
    action:
      'Review fabric durability, zipper reliability, construction quality, and quality-control checks.',
    icon: ShieldCheck,
  },
  {
    slug: 'customer-experience',
    group: 'Customer Experience Issues',
    owner: 'Customer Experience',
    status: 'Open',
    categories: ['Shipping & Delivery', 'Customer Service'],
    businessMeaning:
      'Problems after purchase, delivery, support, return, and refund experience',
    action:
      'Improve delivery tracking, issue resolution speed, refund handling, and customer support follow-up.',
    icon: Headphones,
  },
  {
    slug: 'product-expectation',
    group: 'Product Expectation Issues',
    owner: 'Merchandising',
    status: 'In Review',
    categories: [
      'Sizing & Fit',
      'Color & Product Description',
      'Design & Features',
    ],
    businessMeaning: 'Product did not match customer expectation',
    action:
      'Improve size guidance, product images, fit notes, and product description accuracy.',
    icon: Ruler,
  },
  {
    slug: 'value-perception',
    group: 'Value Perception Issues',
    owner: 'Pricing',
    status: 'Backlog',
    categories: ['Pricing & Value'],
    businessMeaning:
      'Customers feel price is not justified by quality or experience',
    action:
      'Strengthen the value justification for premium pricing through quality consistency and transparent product benefits.',
    icon: CircleDollarSign,
  },
]

export const insightCards = [
  {
    title: 'Most dissatisfaction clusters around product quality perception.',
    description:
      'Fabric, construction, zipper, and cleanliness issues combine into the largest strategic problem set.',
  },
  {
    title: 'Service recovery matters because post-purchase failures are highly visible.',
    description:
      'Shipping delays, damaged deliveries, and support friction compound dissatisfaction after the sale.',
  },
  {
    title: 'Sizing and expectation gaps are mixed frustrations, not always full rejection.',
    description:
      'Fit, color, and product-description mismatches more often surface as disappointment than absolute failure.',
  },
]

export const insightRecommendations = [
  {
    slug: 'quality-control',
    title: 'Strengthen product quality-control testing',
    impact: 'High',
    effort: 'Medium',
    owner: 'Product',
    categories: ['Fabric & Material Quality', 'Zipper Issues', 'Stitching & Construction'],
  },
  {
    slug: 'fulfillment-inspection',
    title: 'Improve pre-shipment fulfillment inspection',
    impact: 'High',
    effort: 'Low',
    owner: 'Customer Experience',
    categories: ['Shipping & Delivery', 'Product Cleanliness'],
  },
  {
    slug: 'fit-guidance',
    title: 'Clarify fit guidance and PDP expectation setting',
    impact: 'Medium',
    effort: 'Medium',
    owner: 'Merchandising',
    categories: ['Sizing & Fit', 'Color & Product Description', 'Design & Features'],
  },
  {
    slug: 'response-playbook',
    title: 'Reduce brand response latency on low-star reviews',
    impact: 'Medium',
    effort: 'Low',
    owner: 'Customer Experience',
    categories: ['Customer Service', 'Shipping & Delivery'],
  },
]

export const pageMetadata = {
  vision: { title: 'Home', path: '/', icon: Eye },
  insights: { title: 'Insights', path: '/insights', icon: Workflow },
  analytics: { title: 'Analytics', path: '/analytics', icon: BarChart3 },
  reviews: { title: 'Reviews Explorer', path: '/reviews', icon: MessageSquareQuote },
  gallery: { title: 'Image Gallery', path: '/gallery', icon: ImageIcon },
}
