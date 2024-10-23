public with sharing class LeadConvertorController {
    
    @AuraEnabled(cacheable = true)
    public static List<Lead> fetchleads(){
        return[SELECT Id,Name,Phone,Company,Rating,Email,Status,isConverted FROM Lead WHERE isConverted = False ORDER BY Name ASC];
    }
    
    @AuraEnabled(cacheable = true)
    public static List<Lead> SelectedleadsReturn(List<Id> SelectedLeads){
        return[SELECT Id,Name,Phone,Company,Rating,Email,Status,isConverted FROM Lead WHERE isConverted = False AND Id IN : SelectedLeads];
    }
  /*  
    @AuraEnabled
	public static List<Lead> fetchRecordsByFilter(String whereClause, String searchedValue) {
    String query = 'SELECT Id, Name, Phone, Company, Rating, Email, Status, IsConverted FROM Lead WHERE ' + whereClause + ' Like %'+searchedValue+'%';
    List<Lead> leadRecords = Database.query(query);
    return leadRecords;
}
    */
    @AuraEnabled
    public static List<Id> convertLead(List<Lead> leads){
        system.debug(leads);
        Id currentUserId = UserInfo.getUserId();
        set<Id> leadIds = new set<Id>();
        set<string> PhoneSet = new set<string>();
        for(Lead LeadRecord : leads){
            if(LeadRecord.Phone != null){
                PhoneSet.add(LeadRecord.Phone);
                leadIds.add(LeadRecord.Id);
            }
        }
        
        Map<string,Id> existingAccountMap = new Map<string,Id>();
        if(PhoneSet != null){
            for(Account ac : [SELECT Id,Phone FROM Account WHERE Phone IN: PhoneSet]){
                existingAccountMap.put(ac.Phone,ac.Id);
            }
        }
        
        List<Database.LeadConvert> leadConvertList = new List<Database.LeadConvert>();
        LeadStatus convertStatus = [SELECT Id, MasterLabel FROM LeadStatus WHERE IsConverted=true LIMIT 1];
        
        List<Id> returnIdsforToast = new List<id>();
        
        for(lead leadIterator:leads){
            Database.LeadConvert leadconvert = new Database.LeadConvert();
            leadconvert.setLeadId(leadIterator.Id);
            leadconvert.setConvertedStatus(convertStatus.MasterLabel);
            leadconvert.setDoNotCreateOpportunity(false); 
            leadconvert.setOwnerId(currentUserId);
            if(existingAccountMap != null && existingAccountMap.size() > 0 && existingAccountMap.containsKey(leadIterator.Phone)){
                Id accountRecord = existingAccountMap.get(leadIterator.Phone);
                leadconvert.setAccountId(accountRecord);
            }
            
            leadConvertList.add(leadconvert);
        }
        if (!leadConvertList.isEmpty()) {
            List<Database.LeadConvertResult> convertResults = Database.convertLead(leadConvertList, false);
            for (Database.LeadConvertResult convertResult : convertResults) {
                if (convertResult.isSuccess()) {
                    System.debug('Successfully inserted account. Account ID: ' + convertResult.getLeadId());
                    returnIdsforToast.add(convertResult.getLeadId());
                }
                else{
                    /*for(Database.LeadConvertResult err : convertResult.getErrors()) {

}*/
                }
            }
        }
        return returnIdsforToast;
    }
}
