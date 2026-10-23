package in.srcenterprises.api;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@SpringBootTest(properties={"SRC_ADMIN_USERNAME=testadmin","SRC_ADMIN_PASSWORD=testpassword-long-strong","DB_URL=jdbc:h2:mem:srcschemes;DB_CLOSE_DELAY=-1"})
@AutoConfigureMockMvc @Transactional
class SchemeDraftTest {
 @Autowired MockMvc mvc;
 @Test void draftNotPublic() throws Exception {
  mvc.perform(get("/api/admin/scheme-drafts")).andExpect(status().isUnauthorized());
  mvc.perform(get("/api/catalog/schemes")).andExpect(status().isForbidden());
 }
 @Test @WithMockUser(roles="ADMIN") void draftCannotBeActivatedBySubmittedFlag() throws Exception {
  String json="{\"name\":\"Internal ten-month study\",\"durationMonths\":10,\"frequency\":\"MONTHLY\",\"contributionAmount\":\"1000.00\",\"complianceApproved\":true}";
  mvc.perform(post("/api/admin/scheme-drafts").contentType(MediaType.APPLICATION_JSON).content(json))
    .andExpect(status().isCreated()).andExpect(jsonPath("$.complianceApproved").value(false));
 }
 @Test @WithMockUser(roles="ADMIN") void rejectsBadFrequency() throws Exception {
  String json="{\"name\":\"Draft\",\"durationMonths\":10,\"frequency\":\"DAILY\",\"contributionAmount\":\"1000.00\"}";
  mvc.perform(post("/api/admin/scheme-drafts").contentType(MediaType.APPLICATION_JSON).content(json)).andExpect(status().isBadRequest());
 }
}
