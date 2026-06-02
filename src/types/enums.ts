export enum ItemType {
  MultipleChoice = 'multiple-choice',
  FreeResponse = 'free-response',
  Essay = 'essay'
}

export enum ItemStatus {
  Draft = 'draft',
  Review = 'review',
  Approved = 'approved',
  Archived = 'archived'
}

export enum SecurityLevel {
  Standard = 'standard',
  Secure = 'secure',
  HighlySecure = 'highly-secure'
}

export enum DynamoDbIndex {
  gsi = 'gsi',
  gsi2 = 'gsi2',
  gsi3 = 'gsi3',
  gsi4 = 'gsi4'
}

export enum EntityType {
  itemVersion = 'ITEM_VERSION',
  item = 'ITEM'
}
