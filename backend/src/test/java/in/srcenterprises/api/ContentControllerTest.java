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
@SpringBootTest(properties={"SRC_ADMIN_USERNAME=testadmin","SRC_ADMIN_PASSWORD=testpassword-long-strong","DB_URL=jdbc:h2:mem:srccontent;DB_CLOSE_DELAY=-1"})
@AutoConfigureMockMvc @Transactional
class ContentControllerTest {
 @Autowired MockMvc mvc;
 @Test void publicCategoriesAndMedia() throws Exception {
  mvc.perform(get("/api/catalog/categories")).andExpect(status().isOk());
  mvc.perform(get("/api/catalog/media")).andExpect(status().isOk());
 }
 @Test void adminContentRequiresAuth() throws Exception {
  mvc.perform(get("/api/admin/media")).andExpect(status().isUnauthorized());
  mvc.perform(post("/api/admin/categories").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isUnauthorized());
 }
 @Test @WithMockUser(roles="ADMIN") void createsCategory() throws Exception {
  mvc.perform(post("/api/admin/categories").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Flower Pots\",\"published\":true}"))
    .andExpect(status().isCreated()).andExpect(jsonPath("$.name").value("Flower Pots"));
  mvc.perform(get("/api/catalog/categories")).andExpect(jsonPath("$[0].name").value("Flower Pots"));
 }
 @Test @WithMockUser(roles="ADMIN") void validatesMediaUrlAndType() throws Exception {
  mvc.perform(post("/api/admin/media").contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Test\",\"type\":\"VIDEO\",\"url\":\"http://invalid.test\"}")).andExpect(status().isBadRequest());
  mvc.perform(post("/api/admin/media").contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Test\",\"type\":\"EXECUTABLE\",\"url\":\"https://example.org/x\"}")).andExpect(status().isBadRequest());
 }
 @Test @WithMockUser(roles="ADMIN") void addsPublishedHero() throws Exception {
  mvc.perform(post("/api/admin/media").contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"SRC Deepavali\",\"type\":\"HERO\",\"url\":\"https://example.org/hero.jpg\",\"published\":true}")).andExpect(status().isCreated());
  mvc.perform(get("/api/catalog/media")).andExpect(jsonPath("$[0].type").value("HERO"));
 }
}
