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
@SpringBootTest(properties={"SRC_ADMIN_USERNAME=testadmin","SRC_ADMIN_PASSWORD=testpassword-long-strong","DB_URL=jdbc:h2:mem:srcpromo;DB_CLOSE_DELAY=-1"})
@AutoConfigureMockMvc @Transactional
class PromotionTest {
 @Autowired MockMvc mvc;
 @Test void publicAccessDoesNotAllowEditing() throws Exception{
  mvc.perform(get("/api/catalog/promotions")).andExpect(status().isOk());
  mvc.perform(post("/api/admin/promotions").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
 }
 @Test @WithMockUser(roles="ADMIN") void createPublicOfferIsAlwaysInformational() throws Exception{
  mvc.perform(post("/api/admin/promotions").contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Festival preview\",\"published\":true,\"informationOnly\":false}"))
   .andExpect(status().isCreated()).andExpect(jsonPath("$.informationOnly").value(true));
  mvc.perform(get("/api/catalog/promotions")).andExpect(jsonPath("$[0].title").value("Festival preview"));
 }
 @Test @WithMockUser(roles="ADMIN") void invalidDateRangeRejected() throws Exception{
  mvc.perform(post("/api/admin/promotions").contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Wrong\",\"startsOn\":\"2026-11-01\",\"endsOn\":\"2026-10-01\"}")).andExpect(status().isBadRequest());
 }
}