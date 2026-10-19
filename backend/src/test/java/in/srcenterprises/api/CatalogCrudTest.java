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

@SpringBootTest(properties={"SRC_ADMIN_USERNAME=testadmin","SRC_ADMIN_PASSWORD=testpassword-long-strong","DB_URL=jdbc:h2:mem:srccrud;DB_CLOSE_DELAY=-1"})
@AutoConfigureMockMvc
@Transactional
class CatalogCrudTest {
 @Autowired MockMvc mvc;
 @Test @WithMockUser(roles="ADMIN") void adminCanCreateAndPublishProduct() throws Exception {
   String body="{\"name\":\"Sample Sparkler\",\"category\":\"Sparklers\",\"description\":\"In-store information only\",\"published\":true,\"fireworks\":true}";
   mvc.perform(post("/api/admin/products").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated()).andExpect(jsonPath("$.name").value("Sample Sparkler"));
   mvc.perform(get("/api/catalog/products")).andExpect(status().isOk()).andExpect(jsonPath("$[0].name").value("Sample Sparkler"));
 }
 @Test @WithMockUser(roles="ADMIN") void rejectsNonHttpsMedia() throws Exception {
   String body="{\"name\":\"Sample\",\"category\":\"Sparklers\",\"published\":true,\"fireworks\":true,\"imageUrl\":\"http://example.com/a.png\"}";
   mvc.perform(post("/api/admin/products").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
 }
 @Test @WithMockUser(roles="ADMIN") void rejectsBlankProductName() throws Exception {
   String body="{\"name\":\"\",\"category\":\"Sparklers\",\"published\":true,\"fireworks\":true}";
   mvc.perform(post("/api/admin/products").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isBadRequest());
 }
 @Test void publicCannotMutateCatalog() throws Exception {
   mvc.perform(delete("/api/admin/products/1")).andExpect(status().isUnauthorized());
 }
}
